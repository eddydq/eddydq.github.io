param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('header-smoke', 'runtime-node', 'browser', 'catalog', 'end-to-end')]
    [string]$Target
)

$ErrorActionPreference = 'Stop'

function Require-Emcc {
    $command = Get-Command emcc -ErrorAction SilentlyContinue
    if (-not $command) {
        Write-Error 'emcc not found on PATH'
        exit 1
    }

    return $command.Path
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Push-Location $repoRoot

try {
    $emcc = Require-Emcc

    if ($Target -eq 'header-smoke') {
        & $emcc `
            analysis/wasm/pp_header_smoke.c `
            -Ianalysis/c_api `
            -o analysis/wasm/header-smoke.mjs
        exit $LASTEXITCODE
    }

    throw "Target '$Target' is not implemented yet."
} finally {
    Pop-Location
}
