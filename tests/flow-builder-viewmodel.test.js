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
            block_id: 'validation.consensus_band',
            group: 'validation',
            inputs: [{ name: 'source', kinds: ['candidate'], cardinality: 'many' }],
            outputs: [{ name: 'accepted', kind: 'candidate' }]
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
        {
            node_id: 'n1',
            block_id: 'representation.select_axis',
            params: { axis: 'y' },
            ui: { position: { x: 140, y: 120 } }
        },
        {
            node_id: 'n2',
            block_id: 'estimation.autocorrelation',
            params: {},
            ui: { position: { x: 420, y: 120 } }
        },
        {
            node_id: 'n3',
            block_id: 'validation.consensus_band',
            params: {},
            ui: {
                position: { x: 700, y: 200 },
                input_slots: { source: 3 },
                output_slots: { accepted: 2 }
            }
        }
    ],
    connections: [
        { source: 'n1.primary', source_socket: 0, target: 'n2.source', target_socket: 0 },
        { source: 'n2.primary', source_socket: 0, target: 'n3.source', target_socket: 0 },
        { source: 'n2.primary', source_socket: 1, target: 'n3.source', target_socket: 2 }
    ],
    outputs: { final: 'n3.accepted' }
};

const model = createBuilderViewModel({
    catalog,
    graph,
    selection: { activeSourcePort: 'n1.primary' }
});

assert.deepStrictEqual(model.paletteGroups.map(group => group.group), ['representation', 'estimation', 'validation']);
assert.equal(model.nodeCards[0].outputPorts[0].slots[0].colorClass, 'port-kind-series');
assert.equal(model.nodeCards[1].inputPorts[0].slots[0].acceptsActiveConnection, true);
assert.deepStrictEqual(model.nodeCards[2].position, { x: 700, y: 200 });
assert.equal(model.nodeCards[2].inputPorts[0].slots.length, 3);
assert.equal(model.nodeCards[2].inputPorts[0].slots[2].isConnected, true);
assert.equal(model.nodeCards[2].inputPorts[0].canAddSlot, true);
assert.equal(model.nodeCards[2].outputPorts[0].slots.length, 2);
