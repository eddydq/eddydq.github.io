const assert = require('node:assert/strict');

const { compileGraph, crc16, PP_MAGIC, PP_VERSION, BLOCK_IDS } = require('../src/flow-compiler.js');

assert.equal(BLOCK_IDS['source.lis3dh'], 0x01);
assert.equal(BLOCK_IDS['source.mpu6050'], 0x02);
assert.equal(BLOCK_IDS['source.polar'], 0x03);
assert.equal(BLOCK_IDS['representation.select_axis'], 0x04);
assert.equal(BLOCK_IDS['representation.vector_magnitude'], 0x05);
assert.equal(BLOCK_IDS['pretraitement.hpf_gravity'], 0x06);
assert.equal(BLOCK_IDS['pretraitement.lowpass'], 0x07);
assert.equal(BLOCK_IDS['estimation.autocorrelation'], 0x08);
assert.equal(BLOCK_IDS['estimation.fft_dominant'], 0x09);
assert.equal(BLOCK_IDS['detection.adaptive_peak_detect'], 0x0A);
assert.equal(BLOCK_IDS['detection.zero_crossing_detect'], 0x0B);
assert.equal(BLOCK_IDS['validation.spm_range_gate'], 0x0C);
assert.equal(BLOCK_IDS['validation.peak_selector'], 0x0D);
assert.equal(BLOCK_IDS['validation.confidence_gate'], 0x0E);
assert.equal(BLOCK_IDS['suivi.kalman_2d'], 0x0F);
assert.equal(BLOCK_IDS['suivi.confirmation_filter'], 0x10);

function test_minimal_pipeline() {
    const graph = {
        nodes: [
            { id: 0, blockId: 'select_axis', params: { axis: 'z' } },
            { id: 1, blockId: 'autocorrelation', params: { min_lag: 50, max_lag: 200, confidence_min: 30, harmonic_pct: 80 } }
        ],
        edges: [
            { src: 0, srcPort: 0, dst: 1, dstPort: 0 }
        ]
    };

    const binary = compileGraph(graph);
    const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);

    assert.equal(view.getUint16(0, true), PP_MAGIC);
    assert.equal(view.getUint8(2), PP_VERSION);
    assert.equal(view.getUint8(3), 2);
    assert.equal(view.getUint8(4), 1);
    console.log('  PASS: test_minimal_pipeline');
}

function test_crc_integrity() {
    const graph = {
        nodes: [{ id: 0, blockId: 'select_axis', params: { axis: 'x' } }],
        edges: []
    };
    const binary = compileGraph(graph);
    const corrupted = new Uint8Array(binary);
    corrupted[12] ^= 0xFF;
    const view = new DataView(corrupted.buffer, corrupted.byteOffset, corrupted.byteLength);
    const storedCrc = view.getUint16(8, true);
    const bodyLen = view.getUint16(6, true);
    const computedCrc = crc16(corrupted.slice(12, 12 + bodyLen));
    assert.notEqual(storedCrc, computedCrc);
    console.log('  PASS: test_crc_integrity');
}

test_minimal_pipeline();
test_crc_integrity();
console.log('All compiler tests passed.');
