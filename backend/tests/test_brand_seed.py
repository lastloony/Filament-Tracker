"""Run real Alembic migrations in a subprocess with isolated temporary databases."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

BACKEND = Path(__file__).resolve().parents[1]


class BrandSeedTest(unittest.TestCase):
    def test_fresh_and_existing_databases(self):
        with tempfile.TemporaryDirectory(prefix="filament-brands-") as folder:
            environment = {**os.environ, "PYTHONPATH": str(BACKEND), "SECRET_KEY": "test-only",
                           "ADMIN_USERNAME": "test", "ADMIN_PASSWORD_HASH": "test-only",
                           "DATABASE_URL": "sqlite:///fresh.db"}
            script = r'''
from contextlib import closing
from pathlib import Path
import sqlite3
from alembic import command
from alembic.config import Config
from app.config import settings

config = Config()
config.set_main_option("script_location", str(Path(__import__("os").environ["PYTHONPATH"]) / "alembic"))
command.upgrade(config, "head")
with closing(sqlite3.connect("fresh.db")) as db:
    names = {row[0] for row in db.execute("SELECT name FROM brands")}
    assert len(names) == 15, names
    assert {"eSUN", "SUNLU", "REC", "Bambu Lab", "Bestfilament"} <= names

settings.database_url = "sqlite:///existing.db"
command.upgrade(config, "d630c4cf37d6")
with closing(sqlite3.connect("existing.db")) as db:
    db.execute("INSERT INTO brands (name) VALUES ('sunlu'), ('Мой бренд')")
    db.execute("INSERT INTO filaments (brand, material, weight_total_g, weight_remaining_g, price, currency) VALUES ('Мой бренд', 'PLA', 1000, 700, 900, 'RUB')")
    db.commit()
command.upgrade(config, "head")
command.upgrade(config, "head")
with closing(sqlite3.connect("existing.db")) as db:
    names = [row[0] for row in db.execute("SELECT name FROM brands")]
    assert len(names) == 16, names
    assert names.count("sunlu") == 1 and "SUNLU" not in names
    assert "Мой бренд" in names
    assert db.execute("SELECT weight_remaining_g FROM filaments").fetchone()[0] == 700
command.downgrade(config, "d630c4cf37d6")
command.upgrade(config, "head")
with closing(sqlite3.connect("existing.db")) as db:
    assert db.execute("SELECT count(*) FROM brands").fetchone()[0] == 16
print("Fresh DB, upgrade, case-insensitive deduplication, repeat and rollback: OK")
'''
            result = subprocess.run([sys.executable, "-c", script], env=environment, cwd=folder,
                                    capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
