const assert = require('node:assert/strict');

const { compileGraph, crc16, PP_MAGIC, PP_VERSION } = require('../src/flow-compiler.js');

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
