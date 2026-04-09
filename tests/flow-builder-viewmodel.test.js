const assert = require('node:assert/strict');

const { createBuilderViewModel } = require('../flow-builder-viewmodel.js');

const catalog = {
    blocks: [
        {
            block_id: 'representation.select_axis',
            group: 'representation',
            inputs: [{ name: 'source', kinds: ['raw_window'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'series' }]
        },
        {
            block_id: 'estimation.autocorrelation',
            group: 'estimation',
            inputs: [{ name: 'source', kinds: ['series'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'candidate' }]
        }
    ]
};

const graph = {
    schema_version: 2,
    nodes: [
        { node_id: 'n1', block_id: 'representation.select_axis', params: { axis: 'y' } },
        { node_id: 'n2', block_id: 'estimation.autocorrelation', params: {} }
    ],
    connections: [{ source: 'n1.primary', target: 'n2.source' }],
    outputs: { final: 'n2.primary' }
};

const model = createBuilderViewModel({
    catalog,
    graph,
    selection: { activeSourcePort: 'n1.primary' }
});

assert.deepStrictEqual(model.paletteGroups.map(group => group.group), ['representation', 'estimation']);
assert.equal(model.nodeCards[0].outputs[0].colorClass, 'port-kind-series');
assert.equal(model.nodeCards[1].inputs[0].acceptsActiveConnection, true);
