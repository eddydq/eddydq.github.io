const assert = require('node:assert/strict');

const { compileGraph, crc16, PP_MAGIC, PP_VERSION, BLOCK_IDS } = require('../src/flow-compiler.js');

assert.deepStrictEqual(Object.keys(BLOCK_IDS), [
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
]);

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
            { id: 0, blockId: 'representation.select_axis', params: { axis: 'z' } },
            { id: 1, blockId: 'estimation.autocorrelation', params: { min_lag: 50, max_lag: 200, confidence_min: 30, harmonic_pct: 80 } }
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
        nodes: [{ id: 0, blockId: 'representation.select_axis', params: { axis: 'x' } }],
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

function parseTlvs(binary) {
    const tlvs = [];
    let offset = 12;

    while (offset < binary.length) {
        const tag = binary[offset];
        const length = binary[offset + 1];
        const value = Array.from(binary.slice(offset + 2, offset + 2 + length));
        tlvs.push({ tag, length, value });
        offset += 2 + length;
    }

    return tlvs;
}

function test_named_refs_override_misleading_socket_metadata() {
    const graph = {
        nodes: [
            { node_id: 'n1', block_id: 'representation.select_axis', params: { axis: 'z' } },
            { node_id: 'n2', block_id: 'validation.peak_selector', params: { min_prominence: 4, min_distance: 2 } }
        ],
        connections: [
            { source: 'input.raw', source_socket: 0, target: 'n1.source', target_socket: 0 },
            { source: 'n1.primary', source_socket: 1, target: 'n2.series', target_socket: 0 }
        ],
        outputs: { final: 'n2.primary' }
    };

    const binary = compileGraph(graph);
    const edgeTlvs = parseTlvs(binary).filter(tlv => tlv.tag === 0x02);

    assert.equal(edgeTlvs.length, 1);
    assert.deepStrictEqual(edgeTlvs[0].value, [0, 0, 1, 1]);
    console.log('  PASS: test_named_refs_override_misleading_socket_metadata');
}

function test_compile_rejects_graphs_over_firmware_node_capacity() {
    const graph = {
        nodes: Array.from({ length: 17 }, (_, index) => ({
            node_id: `n${index}`,
            block_id: 'representation.vector_magnitude',
            params: {}
        })),
        connections: [],
        outputs: {}
    };

    assert.throws(
        () => compileGraph(graph),
        /firmware graph capacity|max nodes|16/i
    );
    console.log('  PASS: test_compile_rejects_graphs_over_firmware_node_capacity');
}

function test_compile_rejects_graphs_over_firmware_edge_capacity() {
    const graph = {
        nodes: Array.from({ length: 16 }, (_, index) => ({
            node_id: `n${index}`,
            block_id: 'representation.vector_magnitude',
            params: {}
        })),
        edges: Array.from({ length: 21 }, (_, index) => ({
            src: index % 16,
            srcPort: 0,
            dst: index % 16,
            dstPort: 0
        }))
    };

    assert.throws(
        () => compileGraph(graph),
        /firmware graph capacity|max edges|20/i
    );
    console.log('  PASS: test_compile_rejects_graphs_over_firmware_edge_capacity');
}

test_minimal_pipeline();
test_crc_integrity();
test_named_refs_override_misleading_socket_metadata();
test_compile_rejects_graphs_over_firmware_node_capacity();
test_compile_rejects_graphs_over_firmware_edge_capacity();
console.log('All compiler tests passed.');
