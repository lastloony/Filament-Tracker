"""Integration checks against the actual packaged server, isolated from user data.

Run: backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v
"""

import http.cookiejar
from contextlib import closing, contextmanager
import json
from pathlib import Path
import queue
import sqlite3
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[2]
EXE = ROOT / "desktop/src-tauri/resources/filament-backend/filament-backend.exe"


class DesktopIntegration(unittest.TestCase):
    @contextmanager
    def temporary_data(self):
        with tempfile.TemporaryDirectory(prefix="filament-desktop-") as temp:
            try:
                yield temp
            finally:
                self.doCleanups()

    def start_backend(self, folder: Path):
        log = (folder / "test.log").open("ab")
        child = subprocess.Popen(
            [str(EXE), "--data-dir", str(folder)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=log,
        )
        self.addCleanup(log.close)

        def stop():
            if child.stdin and not child.stdin.closed:
                child.stdin.close()
            try:
                child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
                self.fail("Backend did not exit after its owner closed stdin")
            finally:
                child.stdout.close()

        self.addCleanup(stop)
        ready = queue.Queue()
        threading.Thread(target=lambda: ready.put(child.stdout.readline()), daemon=True).start()
        try:
            line = ready.get(timeout=45)
        except queue.Empty:
            self.fail("Backend readiness timeout")
        self.assertTrue(line, (folder / "test.log").read_text(errors="replace"))
        url = json.loads(line)["url"]
        parts = urllib.parse.urlsplit(url)
        base = f"{parts.scheme}://{parts.netloc}"
        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        return child, client, base, url

    def request(self, client, url, method="GET", body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url, data=data, method=method,
                                         headers={"Content-Type": "application/json", **(headers or {})})
        with client.open(request, timeout=10) as response:
            content = response.read()
            return response.status, json.loads(content) if content else None

    def assert_status(self, expected, operation):
        with self.assertRaises(urllib.error.HTTPError) as result:
            operation()
        self.assertEqual(result.exception.code, expected)

    def test_packaged_lifecycle(self):
        self.assertTrue(EXE.is_file(), "Build backend with scripts/package-desktop.py first")
        with self.temporary_data() as temp:
            # Exercise non-ASCII names, spaces and ConfigParser's special '%' character.
            folder = Path(temp) / "Данные пользователя 100%"
            folder.mkdir()
            child, client, base, bootstrap = self.start_backend(folder)
            self.assert_status(401, lambda: self.request(client, base + "/api/filaments"))
            with client.open(bootstrap, timeout=10) as page:
                self.assertIn(b'<div id="root">', page.read())
            self.assert_status(403, lambda: client.open(bootstrap, timeout=10))
            _, session = self.request(client, base + "/api/auth/me")
            self.assertTrue(session["desktop"])
            self.assert_status(403, lambda: self.request(client, base + "/api/auth/login", "POST", {}))
            payload = {"brand": "Test", "material": "PLA", "color": "Black", "color_hex": "#000000",
                       "weight_total_g": 1000, "weight_remaining_g": 900, "price": "1200", "currency": "RUB"}
            self.assert_status(403, lambda: self.request(client, base + "/api/filaments", "POST", payload,
                                                        {"Origin": "https://untrusted.example"}))
            code, filament = self.request(client, base + "/api/filaments", "POST", payload)
            self.assertEqual(code, 201)
            self.assertEqual(float(filament["price_per_kg"]), 1200)
            filament_id = filament["id"]
            self.request(client, base + f"/api/filaments/{filament_id}", "PATCH", {"weight_remaining_g": 200})
            _, overview = self.request(client, base + "/api/stats/overview")
            self.assertEqual(overview["by_material_color"][0]["remaining_g"], 200)
            self.assertEqual(len(overview["reorder"]), 1)
            self.assert_status(404, lambda: self.request(client, base + "/api/nonexistent"))
            anonymous = urllib.request.build_opener()
            self.assert_status(401, lambda: self.request(anonymous, base + "/api/filaments"))
            # A second instance must fail before touching the DB or making backups.
            duplicate = subprocess.run([str(EXE), "--data-dir", str(folder)], input=b"", capture_output=True, timeout=15)
            self.assertNotEqual(duplicate.returncode, 0)
            child.stdin.close()
            self.assertEqual(child.wait(timeout=15), 0)
            _, client2, base2, bootstrap2 = self.start_backend(folder)
            client2.open(bootstrap2, timeout=10).close()
            _, saved = self.request(client2, base2 + f"/api/filaments/{filament_id}")
            self.assertEqual(saved["weight_remaining_g"], 200)
            copies = list((folder / "backups").glob("*.db"))
            self.assertEqual(len(copies), 1)
            with closing(sqlite3.connect(copies[0])) as backup:
                self.assertEqual(backup.execute("SELECT weight_remaining_g FROM filaments").fetchone()[0], 200)
            # Stop before TemporaryDirectory tries to remove an open SQLite file on Windows.
            self.doCleanups()


if __name__ == "__main__":
    unittest.main()
