"""Private desktop server. Never imported by the public web deployment."""

import argparse
import asyncio
from contextlib import closing
import json
import logging
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import sys
import threading
from datetime import datetime, timezone


def backup_database(data_dir: Path) -> None:
    database = data_dir / "filament.db"
    if not database.exists():
        return
    backups = data_dir / "backups"
    backups.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    with closing(sqlite3.connect(database)) as source, closing(sqlite3.connect(backups / f"filament-{stamp}.db")) as target:
        source.backup(target)
    for old in sorted(backups.glob("filament-*.db"), reverse=True)[5:]:
        old.unlink()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, type=Path)
    args = parser.parse_args()
    data_dir = args.data_dir.resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    # Prevent simultaneous migrations/writes by two desktop instances.
    lock = (data_dir / "desktop.lock").open("a+b")
    if sys.platform == "win32":
        import msvcrt

        lock.seek(0)
        if not lock.read(1):
            lock.write(b"0")
            lock.flush()
        lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        import fcntl

        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

    resources = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    backup_database(data_dir)
    # Isolate the desktop from .env files and inherited web credentials.
    os.chdir(data_dir)
    os.environ.update(
        SECRET_KEY=secrets.token_urlsafe(48),
        ADMIN_USERNAME="desktop",
        ADMIN_PASSWORD_HASH="desktop-login-disabled",
        DATABASE_URL="sqlite:///" + (data_dir / "filament.db").as_posix(),
        COOKIE_SECURE="false",
    )
    from alembic import command
    from alembic.config import Config
    from fastapi import Cookie, HTTPException, Request
    from fastapi.responses import FileResponse, RedirectResponse, Response
    from fastapi.staticfiles import StaticFiles
    import uvicorn

    migration = Config()
    migration.set_main_option("script_location", str(resources / "alembic").replace("%", "%%"))
    command.upgrade(migration, "head")

    from app.auth import get_current_user
    from app.main import app

    app.state.desktop_mode = True
    bootstrap_key = secrets.token_urlsafe(32)
    session_key = secrets.token_urlsafe(32)
    bootstrap_used = False

    def desktop_user(desktop_session: str | None = Cookie(default=None)) -> str:
        if desktop_session is None or not secrets.compare_digest(desktop_session, session_key):
            raise HTTPException(status_code=401, detail="Desktop session required")
        return "desktop"

    app.dependency_overrides[get_current_user] = desktop_user
    from app.desktop_updates import register_updates

    register_updates(app, desktop_user)

    @app.middleware("http")
    async def restrict_desktop(request: Request, call_next):
        if request.headers.get("host") != authority:
            return Response(status_code=400)
        if request.url.path in ("/api/auth/login", "/api/auth/logout"):
            return Response(status_code=403)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            if origin is not None and origin != f"http://{authority}":
                return Response(status_code=403)
        response = await call_next(request)
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/__desktop/start", include_in_schema=False)
    async def bootstrap(key: str):
        nonlocal bootstrap_used
        if bootstrap_used or not secrets.compare_digest(key, bootstrap_key):
            raise HTTPException(status_code=403)
        bootstrap_used = True
        response = RedirectResponse("/overview", status_code=303)
        response.set_cookie("desktop_session", session_key, httponly=True, samesite="strict")
        return response

    frontend = resources / "frontend"
    if not (frontend / "index.html").is_file():
        raise RuntimeError("Frontend missing. Run npm run build and prepare desktop resources.")
    app.mount("/assets", StaticFiles(directory=frontend / "assets"), name="desktop-assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (frontend / path).resolve()
        if candidate.is_relative_to(frontend.resolve()) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(frontend / "index.html")

    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    authority = f"127.0.0.1:{listener.getsockname()[1]}"
    server = uvicorn.Server(uvicorn.Config(app, log_config=None, access_log=False))

    def parent_watch() -> None:
        # Rust owns the pipe. Closing/crashing the shell shuts down the server.
        sys.stdin.buffer.read()
        server.should_exit = True

    threading.Thread(target=parent_watch, daemon=True).start()

    async def serve() -> None:
        task = asyncio.create_task(server.serve(sockets=[listener]))
        while not server.started:
            if task.done():
                await task
                raise RuntimeError("Desktop server failed to start")
            await asyncio.sleep(0.02)
        print(json.dumps({"url": f"http://{authority}/__desktop/start?key={bootstrap_key}"}), flush=True)
        await task

    try:
        asyncio.run(serve())
    finally:
        listener.close()
        lock.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    try:
        main()
    except Exception:
        logging.exception("Desktop startup failed")
        sys.exit(1)
