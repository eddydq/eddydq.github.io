param(
    [ValidateSet('build', 'catalog', 'clean')]
    [string]$Target = 'build'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$AssetsDir = Join-Path $RepoRoot 'flow-builder\assets'
$FirmwareDir = Join-Path $PSScriptRoot 'firmware'
$BrowserRuntime = Join-Path $AssetsDir 'flow-runtime.js'
$NodeRuntime = Join-Path $PSScriptRoot 'runtime-catalog-node.mjs'
$exportedFunctions = '_pp_wasm_catalog_json,_pp_wasm_run_graph_json,_pp_wasm_last_result_json,_malloc,_free'

function Assert-Emcc {
    $emcc = Get-Command emcc -ErrorAction SilentlyContinue
    if (-not $emcc) {
        throw 'emcc was not found on PATH. Install Emscripten to build the WASM runtime.'
    }
}

function Get-SourceFiles {
    $firmwareSources = Get-ChildItem -LiteralPath $FirmwareDir -Filter '*.c' | Sort-Object Name | ForEach-Object { $_.FullName }
    return @(
        $firmwareSources
        (Join-Path $PSScriptRoot 'pp_wasm_bridge.c')
        (Join-Path $PSScriptRoot 'pp_hw_stubs.c')
    )
}

function Invoke-Emcc {
    param(
        [string]$OutputPath,
        [string[]]$ExtraArgs
    )

    Assert-Emcc
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null

    $args = @(
        (Get-SourceFiles)
        "-I$FirmwareDir"
        '-std=c99'
        '-O2'
        '-DPP_TARGET_WASM'
        '-sMODULARIZE=1'
        '-sALLOW_MEMORY_GROWTH=0'
        '-sSTACK_SIZE=262144'
        "-sEXPORTED_FUNCTIONS=$exportedFunctions"
        '-sEXPORTED_RUNTIME_METHODS=UTF8ToString,lengthBytesUTF8,stringToUTF8'
        '-o'
        $OutputPath
    ) + $ExtraArgs

    & emcc @args
    if ($LASTEXITCODE -ne 0) {
        throw "emcc failed with exit code $LASTEXITCODE"
    }
}

function Invoke-Build {
    Invoke-Emcc `
        -OutputPath $BrowserRuntime `
        -ExtraArgs @('-sEXPORT_NAME=createFlowRuntimeModule')
}

function Invoke-Catalog {
    $nodeRuntimePaths = @(
        (Join-Path $PSScriptRoot 'runtime-catalog-node.mjs'),
        (Join-Path $PSScriptRoot 'runtime-catalog-node.wasm')
    )

    foreach ($path in $nodeRuntimePaths) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    Invoke-Emcc `
        -OutputPath $NodeRuntime `
        -ExtraArgs @(
            '-sEXPORT_NAME=runtimeModuleFactory',
            '-sEXPORT_ES6=1',
            '-sENVIRONMENT=node'
        )

    & node (Join-Path $PSScriptRoot 'extract-catalog.mjs')
    if ($LASTEXITCODE -ne 0) {
        throw "catalog extraction failed with exit code $LASTEXITCODE"
    }
}

function Invoke-Clean {
    $paths = @(
        (Join-Path $AssetsDir 'flow-runtime.js'),
        (Join-Path $AssetsDir 'flow-runtime.wasm'),
        (Join-Path $PSScriptRoot 'runtime-catalog-node.mjs'),
        (Join-Path $PSScriptRoot 'runtime-catalog-node.wasm')
    )

    foreach ($path in $paths) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }
}

switch ($Target) {
    'build' { Invoke-Build }
    'catalog' { Invoke-Catalog }
    'clean' { Invoke-Clean }
}
