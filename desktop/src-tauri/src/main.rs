#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

struct Backend(Mutex<Option<Child>>);

fn stop_backend(handle: &tauri::AppHandle) {
    let child = handle.state::<Backend>().0.lock().unwrap().take();
    if let Some(mut child) = child {
        drop(child.stdin.take());
        for _ in 0..50 {
            if matches!(child.try_wait(), Ok(Some(_))) { return; }
            std::thread::sleep(Duration::from_millis(100));
        }
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn start(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data = app.path().app_local_data_dir()?;
    std::fs::create_dir_all(&data)?;
    let resource = app.path().resource_dir()?;
    let log_path = data.join("desktop.log");
    let log = std::fs::File::create(&log_path)?;
    let executable = resource.join("backend").join("filament-backend.exe");
    let mut command = Command::new(executable);
    command.args(["--data-dir"]).arg(&data)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(log);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let mut child = command.spawn()?;
    let stdout = child.stdout.take().ok_or("Backend stdout unavailable")?;
    *app.state::<Backend>().0.lock().unwrap() = Some(child);
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut lines = BufReader::new(stdout).lines();
        let _ = tx.send(lines.next());
        // Drain the pipe so the child cannot block on later output.
        for _ in lines {}
    });
    let line = rx.recv_timeout(Duration::from_secs(60))?
        .ok_or("Backend exited before startup; see desktop.log")??;
    let ready: serde_json::Value = serde_json::from_str(&line)?;
    let url: tauri::Url = ready["url"].as_str().ok_or("Invalid startup response")?.parse()?;
    if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") {
        return Err("Invalid local backend address".into());
    }
    let base = format!("http://127.0.0.1:{}", url.port().ok_or("Missing port")?);
    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url))
        .title("Filament Tracker")
        .inner_size(1200.0, 800.0)
        .min_inner_size(760.0, 560.0)
        .on_navigation(move |url| url.origin().ascii_serialization() == base)
        .build()?;
    Ok(())
}

fn main() {
    let application = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            if let Err(error) = start(app) {
                stop_backend(app.handle());
                let path = app.path().app_local_data_dir().unwrap_or_default();
                let handle = app.handle().clone();
                app.dialog().message(format!(
                    "Не удалось запустить Filament Tracker. Закройте другие окна приложения и попробуйте снова.\n\nЖурнал: {}\n\n{}",
                    path.join("desktop.log").display(), error
                )).title("Filament Tracker").show(move |_| handle.exit(1));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Unable to create desktop application");
    application.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_backend(handle);
        }
    });
}
