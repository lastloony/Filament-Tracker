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
    assert len(names) == 18, names
    assert {"eSUN", "SUNLU", "REC", "Bambu Lab", "Bestfilament", "DeepLee", "Star Plast", "Нонейм"} <= names

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
    assert len(names) == 19, names
    assert names.count("sunlu") == 1 and "SUNLU" not in names
    assert "Мой бренд" in names
    assert db.execute("SELECT weight_remaining_g FROM filaments").fetchone()[0] == 700
    assert db.execute("SELECT price FROM filaments").fetchone()[0] == 900
command.downgrade(config, "d630c4cf37d6")
command.upgrade(config, "head")
with closing(sqlite3.connect("existing.db")) as db:
    assert db.execute("SELECT count(*) FROM brands").fetchone()[0] == 19

settings.database_url = "sqlite:///already_seeded.db"
command.upgrade(config, "f8a12b90c431")
with closing(sqlite3.connect("already_seeded.db")) as db:
    db.execute("INSERT INTO brands (name) VALUES ('deeplee'), ('Мой бренд')")
    db.commit()
command.upgrade(config, "head")
command.upgrade(config, "head")
with closing(sqlite3.connect("already_seeded.db")) as db:
    names = [row[0] for row in db.execute("SELECT name FROM brands")]
    assert len(names) == 19, names
    assert "Star Plast" in names and "Мой бренд" in names
    assert names.count("deeplee") == 1 and "DeepLee" not in names
    db.execute("INSERT INTO filaments (brand, material, weight_total_g, weight_remaining_g, price, currency) VALUES ('DeepLee', 'PLA', 1000, 500, NULL, 'RUB')")
    db.commit()
try:
    command.downgrade(config, "a42e8d91bc70")
except RuntimeError as error:
    assert "missing prices" in str(error)
else:
    raise AssertionError("Downgrade must not discard unknown prices")
with closing(sqlite3.connect("already_seeded.db")) as db:
    assert db.execute("SELECT price FROM filaments").fetchone()[0] is None
print("Fresh DB, upgrade, case-insensitive deduplication, repeat and rollback: OK")
'''
            result = subprocess.run([sys.executable, "-c", script], env=environment, cwd=folder,
                                    capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
