const assert = require('node:assert/strict');

const { createGraphState } = require('../flow-builder/src/flow-graph.js');
const {
    ensureManagedSourceGraph,
    inspectManagedSourceGraph,
    applyManagedSourceSelection,
    resetManagedSourceGraph,
    getHiddenPaletteBlockIds
} = require('../flow-builder/src/flow-managed-source.js');

const seededGraph = ensureManagedSourceGraph(createGraphState({}));
const seededInspection = inspectManagedSourceGraph(seededGraph);

assert.deepStrictEqual(
    seededGraph.nodes.map(node => node.block_id),
    ['source.polar', 'representation.select_axis']
);
assert.deepStrictEqual(
    seededGraph.connections,
    [
        {
            source: `${seededInspection.sourceNode.node_id}.primary`,
            target: `${seededInspection.axisNode.node_id}.source`
        }
    ]
);
assert.equal(seededInspection.sourceBlockId, 'source.polar');
assert.equal(seededInspection.axis, 'z');
assert.equal(seededInspection.sourceNode.params.sample_rate_hz, 52);
assert.equal(seededInspection.sourceNode.params.resolution, 16);
assert.deepStrictEqual(seededInspection.selection, {
    source: 'source.polar',
    sample_rate_hz: 52,
    resolution: 16,
    axis: 'z'
});
assert.deepStrictEqual(seededInspection.options, {
    source: ['source.lis3dh', 'source.mpu6050', 'source.polar'],
    sample_rate_hz: [52],
    resolution: [16],
    axis: ['x', 'y', 'z']
});
assert.equal(seededInspection.outputRef, `${seededInspection.axisNode.node_id}.primary`);

assert.throws(
    () => ensureManagedSourceGraph(createGraphState({
        nodes: [
            {
                node_id: 'source-a',
                block_id: 'source.lis3dh',
                params: { sample_rate_hz: 100, resolution: 12 }
            },
            {
                node_id: 'magnitude',
                block_id: 'representation.vector_magnitude',
                params: {}
            }
        ],
        connections: [
            { source: 'source-a.primary', target: 'magnitude.source' }
        ]
    })),
    /representation\.select_axis/i
);

const switchedGraph = applyManagedSourceSelection(seededGraph, {
    source_block_id: 'source.lis3dh',
    sample_rate_hz: 999,
    resolution: 9
});
const switchedInspection = inspectManagedSourceGraph(switchedGraph);

assert.equal(switchedInspection.sourceBlockId, 'source.lis3dh');
assert.equal(switchedInspection.sourceNode.params.sample_rate_hz, 100);
assert.equal(switchedInspection.sourceNode.params.resolution, 12);
assert.equal(switchedInspection.axis, 'z');

const visibleSourceGraph = applyManagedSourceSelection(seededGraph, {
    source: 'source.lis3dh'
});
const visibleSourceInspection = inspectManagedSourceGraph(visibleSourceGraph);

assert.equal(visibleSourceInspection.sourceBlockId, 'source.lis3dh');
assert.equal(visibleSourceInspection.sourceNode.params.sample_rate_hz, 100);
assert.equal(visibleSourceInspection.sourceNode.params.resolution, 12);

const preservedAxisGraph = ensureManagedSourceGraph(createGraphState({
    nodes: [
        {
            node_id: 'managed-source',
            block_id: 'source.polar',
            params: { sample_rate_hz: 52, resolution: 16 }
        },
        {
            node_id: 'managed-axis',
            block_id: 'representation.select_axis',
            params: { axis: 'y' }
        }
    ],
    connections: [
        { source: 'managed-source.primary', target: 'managed-axis.source' }
    ]
}));
const preservedAxisGraphResult = applyManagedSourceSelection(preservedAxisGraph, {
    source_block_id: 'source.lis3dh',
    sample_rate_hz: 25,
    resolution: 8
});
const preservedAxisInspection = inspectManagedSourceGraph(preservedAxisGraphResult);

assert.equal(preservedAxisInspection.axis, 'y');
assert.equal(preservedAxisInspection.sourceNode.params.sample_rate_hz, 25);
assert.equal(preservedAxisInspection.sourceNode.params.resolution, 8);

assert.deepStrictEqual(getHiddenPaletteBlockIds(), [
    'source.lis3dh',
    'source.mpu6050',
    'source.polar',
    'representation.select_axis',
    'representation.vector_magnitude'
]);

assert.throws(
    () => inspectManagedSourceGraph(createGraphState({
        nodes: [
            {
                node_id: 'source-a',
                block_id: 'source.lis3dh',
                params: { sample_rate_hz: 100, resolution: 12 }
            },
            {
                node_id: 'source-b',
                block_id: 'source.mpu6050',
                params: { sample_rate_hz: 100, resolution: 16 }
            },
            {
                node_id: 'axis',
                block_id: 'representation.select_axis',
                params: { axis: 'z' }
            }
        ],
        connections: [
            { source: 'source-a.primary', target: 'axis.source' },
            { source: 'source-b.primary', target: 'axis.source' }
        ]
    })),
    /exactly one source/i
);

const resetGraph = resetManagedSourceGraph(createGraphState({
    nodes: [
        {
            node_id: 'source-a',
            block_id: 'source.lis3dh',
            params: { sample_rate_hz: 100, resolution: 12 }
        },
        {
            node_id: 'source-b',
            block_id: 'source.polar',
            params: { sample_rate_hz: 52, resolution: 16 }
        },
        {
            node_id: 'axis',
            block_id: 'representation.select_axis',
            params: { axis: 'y' }
        },
        {
            node_id: 'magnitude',
            block_id: 'representation.vector_magnitude',
            params: {}
        },
        {
            node_id: 'hpf',
            block_id: 'pretraitement.hpf_gravity',
            params: { cutoff_hz: 1 }
        },
        {
            node_id: 'auto',
            block_id: 'estimation.autocorrelation',
            params: {}
        }
    ],
    connections: [
        { source: 'source-a.primary', target: 'axis.source' },
        { source: 'source-b.primary', target: 'magnitude.source' },
        { source: 'axis.primary', source_socket: 0, target: 'hpf.source', target_socket: 0 },
        { source: 'magnitude.primary', source_socket: 0, target: 'auto.source', target_socket: 0 }
    ],
    outputs: {
        cadence: 'axis.primary'
    }
}));
const resetInspection = inspectManagedSourceGraph(resetGraph);

assert.equal(resetInspection.sourceBlockId, 'source.polar');
assert.equal(resetInspection.axis, 'z');
assert.deepStrictEqual(
    resetGraph.nodes.map(node => node.block_id),
    [
        'source.polar',
        'representation.select_axis',
        'pretraitement.hpf_gravity',
        'estimation.autocorrelation'
    ]
);
assert.deepStrictEqual(
    resetGraph.connections,
    [
        { source: 'managed-source.primary', target: 'managed-axis.source' },
        { source: 'managed-axis.primary', source_socket: 0, target: 'hpf.source', target_socket: 0 },
        { source: 'managed-axis.primary', source_socket: 1, target: 'auto.source', target_socket: 0 }
    ]
);
assert.deepStrictEqual(resetGraph.outputs, {
    cadence: 'managed-axis.primary'
});

console.log('managed source helper tests passed');
