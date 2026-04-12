const assert = require('node:assert/strict');

const { createGraphState } = require('../flow-builder/src/flow-graph.js');
const {
    ensureManagedSourceGraph,
    inspectManagedSourceGraph,
    applyManagedSourceSelection,
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

console.log('managed source helper tests passed');
