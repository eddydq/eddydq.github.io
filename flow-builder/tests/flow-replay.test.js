const assert = require('node:assert/strict');

const {
    parsePolarReplayCsv,
    buildReplayExecutionGraph,
    createReplayPacket,
    collectCadencePoint
} = require('../src/flow-replay.js');

function test_parse_polar_csv_respects_count() {
    const csv = [
        'timestamp,count,x_000,x_001,x_002,y_000,y_001,y_002,z_000,z_001,z_002',
        '1000,2,11,12,999,21,22,999,31,32,999'
    ].join('\n');

    const frames = parsePolarReplayCsv(csv);

    assert.deepStrictEqual(frames, [
        {
            timestamp: 1000,
            count: 2,
            x: [11, 12],
            y: [21, 22],
            z: [31, 32]
        }
    ]);
}

function test_build_replay_execution_graph_replaces_source_polar_with_input_raw() {
    const replayGraph = buildReplayExecutionGraph({
        schema_version: 2,
        nodes: [
            { node_id: 'src', block_id: 'source.polar', params: { sample_rate_hz: 52 } },
            { node_id: 'axis', block_id: 'representation.select_axis', params: { axis: 'z' } }
        ],
        connections: [
            { source: 'src.primary', source_socket: 0, target: 'axis.source', target_socket: 0 }
        ],
        outputs: { cadence: 'axis.primary' }
    });

    assert.deepStrictEqual(replayGraph.nodes.map(node => node.node_id), ['axis']);
    assert.deepStrictEqual(replayGraph.connections, [
        { source: 'input.raw', source_socket: 0, target: 'axis.source', target_socket: 0 }
    ]);
}

function test_create_replay_packet_uses_52_hz_raw_window() {
    const packet = createReplayPacket({
        timestamp: 1000,
        count: 3,
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9]
    });

    assert.deepStrictEqual(packet, {
        binding_name: 'raw',
        packet: {
            kind: 'raw_window',
            data: {
                sample_rate_hz: 52,
                length: 3,
                x: [1, 2, 3],
                y: [4, 5, 6],
                z: [7, 8, 9]
            }
        }
    });
}

function test_collect_cadence_point_reads_estimate_value_zero() {
    const point = collectCadencePoint(1234, {
        outputs: {
            cadence: {
                kind: 'estimate',
                length: 2,
                values: [74, 91]
            }
        }
    }, 'cadence');

    assert.deepStrictEqual(point, { timestamp: 1234, cadence: 74 });
}

test_parse_polar_csv_respects_count();
test_build_replay_execution_graph_replaces_source_polar_with_input_raw();
test_create_replay_packet_uses_52_hz_raw_window();
test_collect_cadence_point_reads_estimate_value_zero();
console.log('flow replay tests passed');
