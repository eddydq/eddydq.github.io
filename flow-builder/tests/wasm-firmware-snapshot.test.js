const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '..', 'wasm', 'firmware');
const files = [
    'pp_block.c', 'pp_block.h', 'pp_block_source.c', 'pp_block_representation.c',
    'pp_block_pretraitement.c', 'pp_block_estimation.c', 'pp_block_detection.c',
    'pp_block_validation.c', 'pp_block_suivi.c', 'pp_graph.c', 'pp_graph.h',
    'pp_protocol.c', 'pp_protocol.h'
];

for (const file of files) {
    assert.ok(fs.existsSync(path.join(dir, file)), `missing firmware snapshot file: ${file}`);
}

const blockHeader = fs.readFileSync(path.join(dir, 'pp_block.h'), 'utf8');
assert.match(blockHeader, /PP_BLOCK_LIS3DH_SOURCE\s*=\s*0x01/);
assert.match(blockHeader, /PP_BLOCK_CONFIRMATION\s*=\s*0x10/);
assert.match(blockHeader, /PP_BLOCK_COUNT\s*=\s*16/);

console.log('Firmware snapshot test passed.');
