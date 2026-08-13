<#
Поднимает backend и frontend в режиме разработки (вариант 1 из README — напрямую, без Docker).
Каждый сервис — в своём окне PowerShell, закрыть/остановить их независимо через Ctrl+C или закрытие окна.

Запуск: .\scripts\dev.ps1
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendEnv = Join-Path $BackendDir ".env"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "python не найден в PATH. Нужен Python 3.13+."
    exit 1
}
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv не найден в PATH. Установи: https://docs.astral.sh/uv/ (после установки может понадобиться перезапустить терминал)."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm не найден в PATH. Нужен Node.js."
    exit 1
}

if (-not (Test-Path $BackendEnv)) {
    Copy-Item (Join-Path $RepoRoot ".env.example") $BackendEnv
    Write-Host "Создан backend\.env из .env.example - заполни SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD_HASH и запусти скрипт снова." -ForegroundColor Yellow
    Write-Host "Хэш пароля: см. раздел README про ADMIN_PASSWORD_HASH." -ForegroundColor Yellow
    exit 1
}

Write-Host "Синхронизация backend-зависимостей (uv sync)..." -ForegroundColor Cyan
Push-Location $BackendDir
uv sync
Write-Host "Миграции (alembic upgrade head)..." -ForegroundColor Cyan
uv run alembic upgrade head
Pop-Location

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "Установка frontend-зависимостей (npm install)..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    npm install
    Pop-Location
}

Write-Host "Запускаю backend (http://localhost:8000) и frontend (http://localhost:5173) в отдельных окнах..." -ForegroundColor Green

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$BackendDir'; uv run uvicorn app.main:app --reload --port 8000"
)

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$FrontendDir'; npm run dev"
)

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host "Готово. Остановить — Ctrl+C или закрыть открывшиеся окна backend/frontend." -ForegroundColor Green

