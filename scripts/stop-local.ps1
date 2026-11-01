<#
Останавливает стек, поднятый .\scripts\run-local.ps1 (данные в ./data не удаляются).

Запуск: .\scripts\stop-local.ps1
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ComposeFiles = @("-f", (Join-Path $RepoRoot "docker-compose.yml"), "-f", (Join-Path $RepoRoot "docker-compose.local.yml"))

Push-Location $RepoRoot
docker compose @ComposeFiles down
Pop-Location
