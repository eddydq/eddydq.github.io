const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const bridgePath = path.join(root, 'flow-builder', 'wasm', 'pp_wasm_bridge.c');
const stubsPath = path.join(root, 'flow-builder', 'wasm', 'pp_hw_stubs.c');
const buildPath = path.join(root, 'flow-builder', 'wasm', 'build.ps1');
const extractorPath = path.join(root, 'flow-builder', 'wasm', 'extract-catalog.mjs');

const browserBlockIds = [
    'source.lis3dh',
    'source.mpu6050',
    'source.polar',
    'representation.select_axis',
    'representation.vector_magnitude',
    'pretraitement.hpf_gravity',
    'pretraitement.lowpass',
    'estimation.autocorrelation',
    'estimation.fft_dominant',
    'detection.adaptive_peak_detect',
    'detection.zero_crossing_detect',
    'validation.spm_range_gate',
    'validation.peak_selector',
    'validation.confidence_gate',
    'suivi.kalman_2d',
    'suivi.confirmation_filter'
];

assert.ok(fs.existsSync(bridgePath), 'flow-builder/wasm/pp_wasm_bridge.c exists');
assert.ok(fs.existsSync(stubsPath), 'flow-builder/wasm/pp_hw_stubs.c exists');
assert.ok(fs.existsSync(buildPath), 'flow-builder/wasm/build.ps1 exists');
assert.ok(fs.existsSync(extractorPath), 'flow-builder/wasm/extract-catalog.mjs exists');

const bridge = fs.readFileSync(bridgePath, 'utf8');
const stubs = fs.readFileSync(stubsPath, 'utf8');
const buildScript = fs.readFileSync(buildPath, 'utf8');
const extractor = fs.readFileSync(extractorPath, 'utf8');

for (const symbol of [
    'pp_wasm_catalog_json',
    'pp_wasm_run_graph_json',
    'pp_wasm_last_result_json',
    'pp_block_get_manifest'
]) {
    assert.match(bridge, new RegExp(`\\b${symbol}\\b`), `bridge contains ${symbol}`);
}

for (const blockId of browserBlockIds) {
    assert.ok(bridge.includes(blockId), `bridge contains browser block id ${blockId}`);
}

assert.ok(!bridge.includes('analysis/'), 'bridge does not reference analysis/');

for (const symbol of [
    'pp_lis3dh_source_exec',
    'pp_mpu6050_source_exec',
    'pp_polar_source_exec',
    'PP_SKIP'
]) {
    assert.match(stubs, new RegExp(`\\b${symbol}\\b`), `stubs contain ${symbol}`);
}

assert.ok(
    extractor.includes('flow-builder/assets/flow-block-catalog.json'),
    'extract-catalog.mjs writes flow-builder/assets/flow-block-catalog.json'
);
assert.ok(
    !/flow-block-catalog\.js(?!on)/.test(extractor),
    'extract-catalog.mjs does not write flow-block-catalog.js'
);

assert.match(
    buildScript,
    /flow-builder[\\/]assets/,
    'build.ps1 references flow-builder/assets'
);
assert.ok(buildScript.includes('-DPP_TARGET_WASM'), 'build.ps1 uses -DPP_TARGET_WASM');
assert.ok(
    buildScript.includes('_pp_wasm_catalog_json,_pp_wasm_run_graph_json,_pp_wasm_last_result_json,_malloc,_free'),
    'build.ps1 exports wasm bridge and allocator functions'
);
