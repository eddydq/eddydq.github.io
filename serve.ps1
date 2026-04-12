param(
    [int]$Port = 8000,
    [string]$OpenPath = 'flow-builder/',
    [string]$Watch = 'flow-builder,css,js',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path $PSScriptRoot
$npx = Get-Command npx.cmd, npx -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $npx) {
    throw 'npx was not found on PATH. Install Node.js to use serve.ps1.'
}

$Arguments = @(
    'live-server',
    '.',
    "--port=$Port",
    "--open=$OpenPath",
    "--watch=$Watch"
)

if ($DryRun) {
    [ordered]@{
        command = $npx.Name
        args = $Arguments
        repoRoot = $RepoRoot.Path
    } | ConvertTo-Json -Compress
    exit 0
}

Push-Location $RepoRoot.Path
try {
    & $($npx.Path) @Arguments
} finally {
    Pop-Location
}
