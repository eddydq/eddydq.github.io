const assert = require('node:assert/strict');

const {
    parsePolarReplayCsv,
    buildReplayExecutionGraph,
    createReplayPacket,
    collectCadencePoint,
    runReplaySession
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

async function test_run_replay_session_executes_every_frame_and_collects_series() {
    const calls = [];
    const runtime = {
        async runGraph(payload) {
            calls.push(payload);
            return {
                outputs: {
                    cadence: {
                        kind: 'estimate',
                        length: 2,
                        values: [70 + calls.length, 95]
                    }
                },
                diagnostics: { nodes: [{ node_id: 'axis', status: 'ok' }] }
            };
        }
    };

    const graph = {
        schema_version: 2,
        nodes: [
            { node_id: 'src', block_id: 'source.polar', params: { sample_rate_hz: 52 } },
            { node_id: 'axis', block_id: 'representation.select_axis', params: { axis: 'z' } }
        ],
        connections: [
            { source: 'src.primary', source_socket: 0, target: 'axis.source', target_socket: 0 }
        ],
        outputs: { cadence: 'axis.primary' }
    };

    const frames = [
        { timestamp: 1000, count: 2, x: [1, 2], y: [3, 4], z: [5, 6] },
        { timestamp: 1020, count: 2, x: [7, 8], y: [9, 10], z: [11, 12] }
    ];

    const result = await runReplaySession({ runtime, graph, frames, finalBinding: 'cadence' });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].graph.connections[0].source, 'input.raw');
    assert.deepStrictEqual(result.series, [
        { timestamp: 1000, cadence: 71 },
        { timestamp: 1020, cadence: 72 }
    ]);
    assert.equal(result.lastStepResult.outputs.cadence.values[0], 72);
}

async function test_run_replay_session_reports_row_failures() {
    const runtime = {
        async runGraph() {
            throw new Error('firmware block execution failed');
        }
    };

    await assert.rejects(
        () => runReplaySession({
            runtime,
            graph: {
                schema_version: 2,
                nodes: [{ node_id: 'src', block_id: 'source.polar', params: {} }],
                connections: [],
                outputs: { cadence: 'src.primary' }
            },
            frames: [{ timestamp: 1000, count: 1, x: [1], y: [2], z: [3] }],
            finalBinding: 'cadence'
        }),
        /row 0.*1000.*firmware block execution failed/i
    );
}

async function test_run_replay_session_explains_empty_series_when_final_output_is_not_estimate() {
    const runtime = {
        async runGraph() {
            return {
                outputs: {
                    cadence: {
                        kind: 'candidate',
                        length: 2,
                        values: [68, 80]
                    }
                },
                diagnostics: { nodes: [{ node_id: 'ac', status: 'ok' }] }
            };
        }
    };

    const result = await runReplaySession({
        runtime,
        graph: {
            schema_version: 2,
            nodes: [
                { node_id: 'src', block_id: 'source.polar', params: {} },
                { node_id: 'ac', block_id: 'estimation.autocorrelation', params: { min_lag: 15, max_lag: 104, confidence_min: 0, harmonic_pct: 80 } }
            ],
            connections: [
                { source: 'src.primary', source_socket: 0, target: 'ac.source', target_socket: 0 }
            ],
            outputs: { cadence: 'ac.primary' }
        },
        frames: [{ timestamp: 1000, count: 1, x: [1], y: [2], z: [3] }],
        finalBinding: 'cadence'
    });

    assert.deepStrictEqual(result.series, []);
    assert.equal(result.emptySeriesReason, 'Final output "cadence" must be estimate; got candidate.');
}

async function main() {
    test_parse_polar_csv_respects_count();
    test_build_replay_execution_graph_replaces_source_polar_with_input_raw();
    test_create_replay_packet_uses_52_hz_raw_window();
    test_collect_cadence_point_reads_estimate_value_zero();
    await test_run_replay_session_executes_every_frame_and_collects_series();
    await test_run_replay_session_reports_row_failures();
    await test_run_replay_session_explains_empty_series_when_final_output_is_not_estimate();
    console.log('flow replay tests passed');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
