import tomllib
from pathlib import Path

from fastapi import APIRouter, FastAPI

from app.routers import auth, filaments, stats

_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"


def _read_version() -> str:
    with _PYPROJECT_PATH.open("rb") as f:
        data = tomllib.load(f)
    return data["project"]["version"]


app = FastAPI(title="Filament Tracker", version=_read_version())

# Caddy проксирует /api/* на backend (см. caddy/Caddyfile.example), поэтому
# все роуты, включая health/version, живут под этим префиксом.
api_router = APIRouter(prefix="/api")


@api_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api_router.get("/version")
def version() -> dict[str, str]:
    return {"version": app.version}


api_router.include_router(auth.router)
api_router.include_router(filaments.router)
api_router.include_router(stats.router)

app.include_router(api_router)
