"""Manual GitHub Release checks, registered only by the local desktop entrypoint."""
import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import webbrowser

LATEST_API = "https://api.github.com/repos/lastloony/Filament-Tracker/releases/latest"
RELEASES_URL = "https://github.com/lastloony/Filament-Tracker/releases/latest"


class UpdateCheckError(Exception):
    pass


def version_parts(version: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", version)
    if match is None:
        raise UpdateCheckError("Не удалось определить номер опубликованной версии.")
    return tuple(int(part) for part in match.groups())


def check_for_updates(current_version: str) -> dict:
    result = {"current_version": current_version, "latest_version": None,
              "update_available": False, "has_release": False}
    request = Request(LATEST_API, headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": f"Filament-Tracker/{current_version}",
    })
    try:
        with urlopen(request, timeout=8) as response:
            data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise UpdateCheckError("Ответ GitHub слишком большой. Попробуйте позже.")
        release = json.loads(data)
        if not isinstance(release, dict) or release.get("draft") or release.get("prerelease"):
            raise UpdateCheckError("GitHub вернул неподдерживаемый релиз.")
        tag = release.get("tag_name")
        if not isinstance(tag, str):
            raise UpdateCheckError("В ответе GitHub отсутствует номер версии.")
        latest = version_parts(tag)
        result.update(latest_version=".".join(map(str, latest)), has_release=True,
                      update_available=latest > version_parts(current_version))
        return result
    except HTTPError as error:
        if error.code == 404:
            return result
        if error.code in (403, 429):
            raise UpdateCheckError("GitHub временно ограничил запросы. Попробуйте позже.") from error
        raise UpdateCheckError("GitHub недоступен. Попробуйте позже.") from error
    except (URLError, TimeoutError, OSError) as error:
        raise UpdateCheckError("Не удалось связаться с GitHub. Проверьте подключение к интернету.") from error
    except (ValueError, UnicodeError) as error:
        raise UpdateCheckError("Не удалось прочитать информацию о релизе GitHub.") from error


def register_updates(app, desktop_user) -> None:
    from fastapi import Depends, HTTPException

    @app.get("/api/desktop/updates", dependencies=[Depends(desktop_user)])
    def updates():
        try:
            return check_for_updates(app.version)
        except UpdateCheckError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    @app.post("/api/desktop/updates/open", dependencies=[Depends(desktop_user)])
    def open_release():
        # Fixed destination only: neither a request parameter nor a URL from a remote response.
        try:
            opened = webbrowser.open(RELEASES_URL)
        except (OSError, webbrowser.Error):
            opened = False
        if not opened:
            raise HTTPException(status_code=503, detail="Не удалось открыть браузер. Откройте GitHub Releases вручную.")
        return {"status": "ok"}
