<#
Поднимает весь стек локально через Docker Compose без Caddy (plain HTTP на localhost) —
для человека без опыта разработки: нужен только установленный Docker Desktop,
Python/uv/npm на хосте не требуются.

Запуск: .\scripts\run-local.ps1
Остановка: .\scripts\stop-local.ps1
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RepoRoot ".env"
$ComposeFiles = @("-f", (Join-Path $RepoRoot "docker-compose.yml"), "-f", (Join-Path $RepoRoot "docker-compose.local.yml"))

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "docker не найден в PATH. Нужен Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}

Push-Location $RepoRoot

if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $RepoRoot ".env.example") $EnvFile

    $password = Read-Host "Пароль для пользователя admin (Enter - будет 'admin')"
    if ([string]::IsNullOrWhiteSpace($password)) {
        $password = "admin"
    }

    $secretKeyBytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secretKeyBytes)
    $secretKey = [System.Convert]::ToBase64String($secretKeyBytes)

    Write-Host "Собираю образ backend (нужен один раз, чтобы посчитать хэш пароля)..." -ForegroundColor Cyan
    docker compose @ComposeFiles build backend

    $hashOutput = docker compose @ComposeFiles run --rm --no-deps backend uv run python -c "import bcrypt, sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt()).decode())" $password
    $passwordHash = ($hashOutput | Select-Object -Last 1).Trim()
    # docker compose интерполирует "$" в .env как переменные — удваиваем, чтобы хэш не обрезался
    $escapedHash = $passwordHash -replace '\$', '$$$$'

    (Get-Content $EnvFile) | ForEach-Object {
        if ($_ -match '^SECRET_KEY=') { "SECRET_KEY=$secretKey" }
        elseif ($_ -match '^ADMIN_USERNAME=') { 'ADMIN_USERNAME=admin' }
        elseif ($_ -match '^ADMIN_PASSWORD_HASH=') { "ADMIN_PASSWORD_HASH=$escapedHash" }
        elseif ($_ -match '^# COOKIE_SECURE=false') { 'COOKIE_SECURE=false' }
        else { $_ }
    } | Set-Content $EnvFile

    Write-Host "Создан .env: admin / $password (при необходимости смени пароль в .env)." -ForegroundColor Yellow
}

Write-Host "Запускаю backend и frontend (без Caddy, plain HTTP)..." -ForegroundColor Green
docker compose @ComposeFiles up -d --build backend frontend
Pop-Location

Start-Sleep -Seconds 2
Start-Process "http://localhost:8080"

Write-Host "Готово: http://localhost:8080 . Остановить — .\scripts\stop-local.ps1" -ForegroundColor Green
