import tomllib
from pathlib import Path

from fastapi import FastAPI

from app.routers import auth, filaments, stats

_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"


def _read_version() -> str:
    with _PYPROJECT_PATH.open("rb") as f:
        data = tomllib.load(f)
    return data["project"]["version"]


app = FastAPI(title="Filament Tracker", version=_read_version())
app.include_router(auth.router)
app.include_router(filaments.router)
app.include_router(stats.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str]:
    return {"version": app.version}
