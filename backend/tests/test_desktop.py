"""Integration checks against the actual packaged server, isolated from user data.

Run: backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v
"""

import http.cookiejar
from contextlib import closing, contextmanager
import json
from pathlib import Path
import queue
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import tomllib
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

    def start_backend(self, folder: Path, executable=None):
        log = (folder / "test.log").open("ab")
        child = subprocess.Popen(
            [*(executable or [str(EXE)]), "--data-dir", str(folder)],
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

    def test_source_desktop_updates(self):
        with self.temporary_data() as temp:
            resources = Path(temp) / "resources"
            resources.mkdir()
            shutil.copytree(ROOT / "backend/alembic", resources / "alembic", ignore=shutil.ignore_patterns("__pycache__"))
            shutil.copytree(ROOT / "frontend/dist", resources / "frontend")
            folder = Path(temp) / "data"
            folder.mkdir()
            script = (
                "import sys,io; "
                f"sys.path.insert(0,{str(ROOT / 'backend')!r}); "
                f"sys._MEIPASS={str(resources)!r}; "
                "from app import desktop_updates; "
                "desktop_updates.urlopen=lambda *a,**k: io.BytesIO(b'{\"tag_name\":\"v99.0.0\"}'); "
                "desktop_updates.webbrowser.open=lambda url: url==desktop_updates.RELEASES_URL; "
                "import desktop_entry; desktop_entry.main()"
            )
            _, client, base, bootstrap = self.start_backend(folder, [sys.executable, "-c", script])
            self.assert_status(401, lambda: self.request(client, base + "/api/desktop/updates"))
            self.assert_status(401, lambda: self.request(client, base + "/api/desktop/updates/open", "POST"))
            self.assert_status(401, lambda: client.open(base + "/api/desktop/backups/download", timeout=10))
            client.open(bootstrap, timeout=10).close()
            _, brands = self.request(client, base + "/api/settings/brands")
            self.assertEqual(len(brands), 18)
            self.assertIn("Нонейм", [brand["name"] for brand in brands])
            _, result = self.request(client, base + "/api/desktop/updates")
            self.assertTrue(result["update_available"])
            self.assertEqual(result["latest_version"], "99.0.0")
            self.assertEqual(self.request(client, base + "/api/desktop/updates/open", "POST")[0], 200)
            self.assert_status(403, lambda: self.request(client, base + "/api/desktop/updates/open", "POST",
                                                        headers={"Origin": "https://untrusted.example"}))
            minimal = {"brand": "DeepLee", "material": "PLA", "color": "Чёрный", "weight_total_g": 1000, "weight_remaining_g": 800}
            self.assert_status(422, lambda: self.request(client, base + "/api/filaments", "POST",
                                                        {key: value for key, value in minimal.items() if key != "color"}))
            for invalid_color in (None, "", "   ", 123):
                self.assert_status(422, lambda: self.request(client, base + "/api/filaments", "POST", {**minimal, "color": invalid_color}))
            _, unpriced = self.request(client, base + "/api/filaments", "POST", minimal)
            self.assertIsNone(unpriced["price"])
            self.assertIsNone(unpriced["price_per_kg"])
            self.assertIsNone(unpriced["vendor"])
            self.assertIsNone(unpriced["rating"])
            self.assertEqual(unpriced["currency"], "RUB")
            _, summary = self.request(client, base + "/api/stats/summary")
            self.assertEqual(summary["total_invested"], [])
            self.assertEqual(summary["missing_price_count"], 1)
            _, by_brand = self.request(client, base + "/api/stats/by-brand")
            self.assertIsNone(by_brand[0]["total_spent"])
            self.assert_status(422, lambda: self.request(client, base + "/api/filaments", "POST", {**minimal, "price": -1}))
            self.request(client, base + "/api/filaments", "POST", {**minimal, "brand": "eSUN", "price": "0", "currency": "EUR"})
            self.request(client, base + "/api/filaments", "POST", {**minimal, "brand": "REC", "price": "100", "currency": "USD", "rating": 4})
            _, summary = self.request(client, base + "/api/stats/summary")
            self.assertEqual({item["currency"]: float(item["total"]) for item in summary["total_invested"]}, {"EUR": 0, "USD": 100})
            self.assertEqual(summary["missing_price_count"], 1)
            self.assertEqual(float(summary["remaining_kg"]), 2.4)
            self.assertEqual(summary["avg_rating"], 4)
            _, priced = self.request(client, base + f"/api/filaments/{unpriced['id']}", "PATCH", {"price": "80"})
            self.assertEqual(float(priced["price_per_kg"]), 80)
            _, cleared = self.request(client, base + f"/api/filaments/{unpriced['id']}", "PATCH", {"price": None})
            self.assertIsNone(cleared["price_per_kg"])
            _, euro = self.request(client, base + "/api/settings/currencies", "POST", {"code": "EUR"})
            self.request(client, base + f"/api/settings/currencies/{euro['id']}/set-base", "POST")
            _, default_currency = self.request(client, base + "/api/filaments", "POST", minimal)
            self.assertEqual(default_currency["currency"], "EUR")
            without_brand = {key: value for key, value in minimal.items() if key != "brand"}
            _, unnamed = self.request(client, base + "/api/filaments", "POST", without_brand)
            self.assertEqual(unnamed["brand"], "Нонейм")
            for empty_brand in (None, "", "   "):
                _, unnamed = self.request(client, base + "/api/filaments", "POST", {**minimal, "brand": empty_brand})
                self.assertEqual(unnamed["brand"], "Нонейм")
            _, unnamed = self.request(client, base + f"/api/filaments/{unpriced['id']}", "PATCH", {"brand": ""})
            self.assertEqual(unnamed["brand"], "Нонейм")
            for invalid_color in (None, "", "   ", 123):
                self.assert_status(422, lambda: self.request(client, base + f"/api/filaments/{unpriced['id']}", "PATCH", {"color": invalid_color}))
            self.request(client, base + "/api/settings/reorder-rules", "POST",
                         {"material": "PLA", "color": "Чёрный", "threshold_g": 100})
            _, filaments = self.request(client, base + "/api/filaments")
            exported = Path(temp) / "manual-backup.db"
            with client.open(base + "/api/desktop/backups/download", timeout=10) as response:
                self.assertEqual(response.headers.get_content_type(), "application/vnd.sqlite3")
                self.assertIn("attachment;", response.headers["Content-Disposition"])
                self.assertIn("-backup-", response.headers["Content-Disposition"])
                self.assertEqual(response.headers["Cache-Control"], "no-store")
                exported.write_bytes(response.read())
            with closing(sqlite3.connect(exported)) as snapshot:
                self.assertEqual(snapshot.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(snapshot.execute("SELECT count(*) FROM filaments").fetchone()[0], len(filaments))
                self.assertEqual(snapshot.execute("SELECT count(*) FROM brands").fetchone()[0], 18)
                self.assertEqual(snapshot.execute("SELECT code FROM currencies WHERE is_base=1").fetchone()[0], "EUR")
                self.assertEqual(snapshot.execute("SELECT count(*) FROM reorder_rules").fetchone()[0], 1)
                self.assertIsNotNone(snapshot.execute("SELECT version_num FROM alembic_version").fetchone())
            self.request(client, base + "/api/filaments", "POST", minimal)
            with closing(sqlite3.connect(exported)) as snapshot:
                self.assertEqual(snapshot.execute("SELECT count(*) FROM filaments").fetchone()[0], len(filaments))

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
            _, version = self.request(client, base + "/api/version")
            expected_version = tomllib.loads((ROOT / "backend/pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
            self.assertEqual(version["version"], expected_version)
            code, brand = self.request(client, base + "/api/settings/brands", "POST", {"name": "Test"})
            self.assertEqual(code, 201)
            _, brands = self.request(client, base + "/api/settings/brands")
            self.assertIn(brand, brands)
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
            _, saved_brands = self.request(client2, base2 + "/api/settings/brands")
            self.assertIn(brand, saved_brands)
            copies = list((folder / "backups").glob("*.db"))
            self.assertEqual(len(copies), 1)
            with closing(sqlite3.connect(copies[0])) as backup:
                self.assertEqual(backup.execute("SELECT weight_remaining_g FROM filaments").fetchone()[0], 200)
            # Stop before TemporaryDirectory tries to remove an open SQLite file on Windows.
            self.doCleanups()


if __name__ == "__main__":
    unittest.main()
