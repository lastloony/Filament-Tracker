from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.desktop_backups import create_snapshot


class BackupTest(unittest.TestCase):
    def test_live_wal_database(self):
        with tempfile.TemporaryDirectory(prefix="filament-snapshot-") as folder:
            source_path = Path(folder) / "База 100%.db"
            snapshot_path = Path(folder) / "copy.db"
            with closing(sqlite3.connect(source_path)) as source:
                source.execute("PRAGMA journal_mode=WAL")
                source.execute("CREATE TABLE records (name TEXT)")
                source.execute("INSERT INTO records VALUES ('saved')")
                source.commit()
                source.execute("INSERT INTO records VALUES ('uncommitted')")
                create_snapshot(source_path, snapshot_path)
                with closing(sqlite3.connect(snapshot_path)) as snapshot:
                    self.assertEqual(snapshot.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                    self.assertEqual(snapshot.execute("SELECT name FROM records").fetchall(), [("saved",)])
                source.rollback()
                source.execute("INSERT INTO records VALUES ('after backup')")
                source.commit()
            with closing(sqlite3.connect(snapshot_path)) as snapshot:
                self.assertEqual(snapshot.execute("SELECT count(*) FROM records").fetchone()[0], 1)

    def test_missing_source_does_not_create_database(self):
        with tempfile.TemporaryDirectory(prefix="filament-snapshot-") as folder:
            source = Path(folder) / "missing.db"
            with self.assertRaises(sqlite3.OperationalError):
                create_snapshot(source, Path(folder) / "copy.db")
            self.assertFalse(source.exists())
