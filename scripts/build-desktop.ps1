<# Build a Windows installer. Requires Python 3.13/uv, Node, Rust and MSVC build tools. #>
param(
    [string]$Python = '3.13'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([string]$Exe, [string[]]$Arguments)
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Exe ($LASTEXITCODE)" }
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $rustBin = Join-Path $env:USERPROFILE '.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin'
    if (Test-Path (Join-Path $rustBin 'cargo.exe')) { $env:PATH = "$rustBin;$env:PATH" }
}
foreach ($tool in @('uv', 'npm.cmd', 'cargo')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Build dependency missing: $tool. See desktop/README.md."
    }
}
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
if (-not (Test-Path $vswhere)) {
    throw 'Install Visual Studio Build Tools: Desktop development with C++ (MSVC + Windows SDK).'
}
$visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $visualStudio) { throw 'MSVC C++ build tools missing. See desktop/README.md.' }
Push-Location $repo
try {
    Invoke-Checked 'uv' @('sync', '--project', 'backend', '--group', 'desktop', '--frozen', '--python', $Python)
    Push-Location frontend
    try {
        Invoke-Checked 'npm.cmd' @('ci')
        Invoke-Checked 'npm.cmd' @('run', 'build')
    } finally { Pop-Location }
    $projectPython = Join-Path $repo 'backend/.venv/Scripts/python.exe'
    Invoke-Checked $projectPython @('scripts/package-desktop.py')
    Invoke-Checked $projectPython @('-m', 'unittest', 'discover', '-s', 'backend/tests', '-v')
    Push-Location desktop
    try {
        Invoke-Checked 'npm.cmd' @('ci')
        Invoke-Checked 'npm.cmd' @('run', 'tauri', '--', 'icon', 'icon.svg')
        Invoke-Checked 'npm.cmd' @('run', 'build', '--', '--', '--locked')
    } finally { Pop-Location }
} finally { Pop-Location }
