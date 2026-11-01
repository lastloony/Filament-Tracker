"""Consistent, user-requested SQLite exports for the desktop application."""
from contextlib import closing
from datetime import datetime, timezone
import logging
from pathlib import Path
import sqlite3
import tempfile
import time


def create_snapshot(database: Path, destination: Path) -> None:
    deadline = time.monotonic() + 30

    def progress(status, remaining, total):
        if time.monotonic() > deadline:
            raise TimeoutError("SQLite backup timed out")

    # Read-only source: never create an empty working DB if the path is missing.
    with closing(sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)) as source:
        with closing(sqlite3.connect(destination)) as target:
            source.backup(target, pages=128, progress=progress, sleep=0.05)
            if target.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise sqlite3.DatabaseError("Backup integrity check failed")


def register_backups(app, desktop_user, database: Path) -> None:
    from fastapi import Depends, HTTPException
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask

    @app.get("/api/desktop/backups/download", dependencies=[Depends(desktop_user)])
    def download_backup():
        temporary = None
        try:
            temporary = tempfile.TemporaryDirectory(prefix="filament-export-")
            snapshot = Path(temporary.name) / "backup.db"
            create_snapshot(database, snapshot)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
            return FileResponse(
                snapshot,
                media_type="application/vnd.sqlite3",
                filename=f"Filament-Tracker-{app.version}-backup-{stamp}.db",
                background=BackgroundTask(temporary.cleanup),
            )
        except (OSError, sqlite3.Error, TimeoutError) as error:
            if temporary is not None:
                temporary.cleanup()
            logging.exception("Manual desktop backup failed")
            raise HTTPException(status_code=503, detail="Не удалось создать резервную копию. Проверьте свободное место и повторите попытку.") from error
