"""Package the backend and web assets with the invoking project's interpreter."""

from pathlib import Path
import subprocess
import sys
import tomllib
import json

root = Path(__file__).resolve().parent.parent
backend = root / "backend"
version = tomllib.loads((backend / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
config_path = root / "desktop/src-tauri/tauri.conf.json"
config = json.loads(config_path.read_text(encoding="utf-8"))
config["version"] = version
config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
subprocess.run([
    sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
    "--name", "filament-backend", "--paths", str(backend),
    "--distpath", str(root / "desktop/src-tauri/resources"),
    "--workpath", str(backend / "build/desktop"),
    "--specpath", str(backend / "build"),
    "--collect-submodules", "uvicorn",
    "--collect-submodules", "alembic.runtime",
    "--collect-submodules", "alembic.operations",
    "--collect-submodules", "alembic.ddl",
    "--hidden-import", "sqlalchemy.dialects.sqlite",
    "--add-data", f"{backend / 'alembic'};alembic",
    "--add-data", f"{backend / 'pyproject.toml'};.",
    "--add-data", f"{root / 'frontend/dist'};frontend",
    str(backend / "desktop_entry.py"),
], check=True, cwd=backend)
