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

    if ($Target -eq 'browser') {
        & $emcc `
            analysis/c_runtime/pp_graph_validate.c `
            analysis/c_runtime/pp_graph_schedule.c `
            analysis/c_runtime/pp_runtime.c `
            analysis/c_blocks/pp_block_catalog.c `
            analysis/c_blocks/representation/pp_block_select_axis.c `
            analysis/c_blocks/estimation/pp_block_autocorrelation.c `
            analysis/c_blocks/validation/pp_block_spm_range_gate.c `
            analysis/c_blocks/suivi/pp_block_kalman_2d.c `
            analysis/wasm/pp_wasm_exports.c `
            -Ianalysis/c_api `
            -o assets/flow-runtime.js `
            -sMODULARIZE=1 `
            -sEXPORT_NAME=createFlowRuntimeModule `
            '-sEXPORTED_FUNCTIONS=_pp_wasm_catalog_json,_pp_wasm_run_graph_json,_pp_wasm_last_result_json,_malloc,_free' `
            '-sEXPORTED_RUNTIME_METHODS=UTF8ToString,stringToUTF8,lengthBytesUTF8'
        exit $LASTEXITCODE
    }

    if ($Target -eq 'catalog') {
        & $emcc `
            analysis/c_runtime/pp_graph_validate.c `
            analysis/c_runtime/pp_graph_schedule.c `
            analysis/c_runtime/pp_runtime.c `
            analysis/c_blocks/pp_block_catalog.c `
            analysis/c_blocks/representation/pp_block_select_axis.c `
            analysis/c_blocks/estimation/pp_block_autocorrelation.c `
            analysis/c_blocks/validation/pp_block_spm_range_gate.c `
            analysis/c_blocks/suivi/pp_block_kalman_2d.c `
            analysis/wasm/pp_wasm_exports.c `
            -Ianalysis/c_api `
            -o analysis/wasm/runtime-catalog-node.mjs `
            -sMODULARIZE=1 `
            -sEXPORT_NAME=createFlowRuntimeModule `
            -sENVIRONMENT=node `
            '-sEXPORTED_FUNCTIONS=_pp_wasm_catalog_json,_pp_wasm_run_graph_json,_pp_wasm_last_result_json,_malloc,_free' `
            '-sEXPORTED_RUNTIME_METHODS=UTF8ToString'
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }

        node analysis/wasm/extract-catalog.mjs
        exit $LASTEXITCODE
    }

    if ($Target -eq 'end-to-end') {
        & powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target browser
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }

        & powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target catalog
        exit $LASTEXITCODE
    }

    if ($Target -eq 'runtime-node') {
        & $emcc `
            analysis/c_runtime/pp_graph_validate.c `
            analysis/c_runtime/pp_graph_schedule.c `
            analysis/c_runtime/pp_runtime.c `
            analysis/c_blocks/pp_block_catalog.c `
            analysis/c_blocks/representation/pp_block_select_axis.c `
            analysis/c_blocks/estimation/pp_block_autocorrelation.c `
            analysis/c_blocks/validation/pp_block_spm_range_gate.c `
            analysis/c_blocks/suivi/pp_block_kalman_2d.c `
            analysis/wasm/pp_runtime_node_smoke.c `
            -Ianalysis/c_api `
            -o analysis/wasm/runtime-smoke.mjs
        exit $LASTEXITCODE
    }

    throw "Target '$Target' is not implemented yet."
} finally {
    Pop-Location
}
