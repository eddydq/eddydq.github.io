const assert = require('node:assert/strict');

const {
    SCHEMA_VERSION,
    PACKET_KIND_COLORS,
    createGraphState,
    serializeGraph,
    validateGraph,
    topologicallySortGraph
} = require('../flow-builder/src/flow-graph.js');

const catalog = {
    'representation.select_axis': {
        input_ports: [{ name: 'source', kinds: ['raw_window'], cardinality: 'one' }],
        output_ports: [{ name: 'primary', kind: 'series' }]
    },
    'estimation.autocorrelation': {
        input_ports: [{ name: 'source', kinds: ['series'], cardinality: 'one' }],
        output_ports: [{ name: 'primary', kind: 'candidate' }]
    },
    'validation.consensus_band': {
        input_ports: [{ name: 'source', kinds: ['candidate'], cardinality: 'many' }],
        output_ports: [
            { name: 'accepted', kind: 'candidate' },
            { name: 'rejected', kind: 'candidate' }
        ]
    }
};
const normalizedCatalog = {
    byId: {
        'representation.select_axis': {
            inputs: [{ name: 'source', kinds: ['raw_window'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'series' }]
        },
        'estimation.autocorrelation': {
            inputs: [{ name: 'source', kinds: ['series'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'candidate' }]
        },
        'validation.consensus_band': {
            inputs: [{ name: 'source', kinds: ['candidate'], cardinality: 'many' }],
            outputs: [
                { name: 'accepted', kind: 'candidate' },
                { name: 'rejected', kind: 'candidate' }
            ]
        }
    }
};

const validGraph = createGraphState({
    nodes: [
        {
            node_id: 'n1',
            block_id: 'representation.select_axis',
            params: { axis: 'y', tuning: { smooth: true } },
            ui: { position: { x: 120, y: 80 } }
        },
        {
            node_id: 'n2',
            block_id: 'estimation.autocorrelation',
            params: { window: 64 },
            ui: { position: { x: 420, y: 120 } }
        },
        {
            node_id: 'n3',
            block_id: 'validation.consensus_band',
            params: { tolerance_spm: 5 },
            ui: {
                position: { x: 720, y: 160 },
                input_slots: { source: 3 },
                output_slots: { accepted: 2 }
            }
        }
    ],
    connections: [
        { source: 'input.raw', source_socket: 0, target: 'n1.source', target_socket: 0 },
        { source: 'n1.primary', source_socket: 0, target: 'n2.source', target_socket: 0 },
        { source: 'n2.primary', source_socket: 0, target: 'n3.source', target_socket: 0 },
        { source: 'n2.primary', source_socket: 1, target: 'n3.source', target_socket: 2 }
    ],
    outputs: { accepted: 'n3.accepted' },
    ui: {
        system_nodes: {
            input: { x: 40, y: 100 },
            output: { x: 980, y: 180 }
        },
        output_bindings: {
            accepted: { source_socket: 1 }
        }
    }
});

const clonedGraph = createGraphState(validGraph);
validGraph.nodes[0].params.tuning.smooth = false;
assert.equal(clonedGraph.nodes[0].params.tuning.smooth, true);
validGraph.nodes[2].ui.position.x = 999;
assert.equal(clonedGraph.nodes[2].ui.position.x, 720);
assert.equal(clonedGraph.connections[3].target_socket, 2);
validGraph.ui.system_nodes.input.x = 1234;
assert.equal(clonedGraph.ui.system_nodes.input.x, 40);

assert.equal(SCHEMA_VERSION, 2);
assert.equal(PACKET_KIND_COLORS.series, 'port-kind-series');
assert.deepStrictEqual(validateGraph(validGraph, catalog), []);
assert.deepStrictEqual(validateGraph(validGraph, normalizedCatalog), []);
assert.deepStrictEqual(topologicallySortGraph(validGraph), ['n1', 'n2', 'n3']);
assert.deepStrictEqual(serializeGraph(validGraph).schema_version, 2);
assert.deepStrictEqual(serializeGraph(clonedGraph).nodes[2].ui.output_slots.accepted, 2);
assert.deepStrictEqual(serializeGraph(clonedGraph).ui.output_bindings.accepted.source_socket, 1);
assert.match(
    validateGraph({
        nodes: [],
        connections: [],
        outputs: {}
    }, catalog)[0],
    /unsupported schema version/i
);
assert.match(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'dup', block_id: 'representation.select_axis', params: {} },
            { node_id: 'dup', block_id: 'estimation.autocorrelation', params: {} }
        ],
        connections: [],
        outputs: {}
    }), catalog)[0],
    /duplicate node id/i
);
assert.equal(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'missing', block_id: 'representation.select_axis', params: {} }
        ],
        connections: [],
        outputs: {}
    }), catalog).some(error => /missing required input connection/i.test(error)),
    true
);
assert.equal(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'missing', block_id: 'representation.select_axis', params: {} }
        ],
        connections: [],
        outputs: {}
    }), normalizedCatalog).some(error => /missing required input connection/i.test(error)),
    true
);
assert.equal(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'n1', block_id: 'representation.select_axis', params: {} },
            { node_id: 'n2', block_id: 'representation.select_axis', params: {} }
        ],
        connections: [
            { source: 'input.raw', target: 'n1.source' },
            { source: 'n1.primary', target: 'n2.source' }
        ],
        outputs: {}
    }), catalog).some(error => /packet kind mismatch/i.test(error)),
    true
);
assert.equal(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'n1', block_id: 'representation.select_axis', params: {} },
            { node_id: 'n2', block_id: 'estimation.autocorrelation', params: {} }
        ],
        connections: [
            { source: 'input.raw', target: 'n1.source' },
            { source: 'n1.primary', target: 'n2.missing' }
        ],
        outputs: {}
    }), catalog).some(error => /unknown input port/i.test(error)),
    true
);
assert.equal(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'n1', block_id: 'representation.select_axis', params: {} }
        ],
        connections: [
            { source: 'input.typo', target: 'n1.source' }
        ],
        outputs: {}
    }), catalog).some(error => /unknown system input/i.test(error)),
    true
);
assert.equal(
    validateGraph(createGraphState({
        nodes: [
            { node_id: 'n1', block_id: 'representation.select_axis', params: {} },
            { node_id: 'n2', block_id: 'estimation.autocorrelation', params: {} }
        ],
        connections: [
            { source: 'input.raw', target: 'n1.source' },
            { source: 'n1.primary', target: 'n2.source' },
            { source: 'n1.primary', target: 'n2.source' }
        ],
        outputs: {}
    }), catalog).some(error => /single-cardinality input already connected/i.test(error)),
    true
);

const cycleGraph = createGraphState({
    nodes: [
        { node_id: 'a', block_id: 'representation.select_axis', params: {} },
        { node_id: 'b', block_id: 'representation.select_axis', params: {} }
    ],
    connections: [
        { source: 'a.primary', target: 'b.source' },
        { source: 'b.primary', target: 'a.source' }
    ],
    outputs: { final: 'b.primary' }
});

assert.equal(
    validateGraph(cycleGraph, catalog).some(error => /cycle/i.test(error)),
    true
);

const unconstrainedCatalog = {
    'representation.vector_magnitude': {
        input_ports: [],
        output_ports: [{ name: 'primary', kind: 'series' }]
    }
};

assert.equal(
    validateGraph(createGraphState({
        nodes: Array.from({ length: 17 }, (_, index) => ({
            node_id: `n${index}`,
            block_id: 'representation.vector_magnitude',
            params: {}
        })),
        connections: [],
        outputs: {}
    }), unconstrainedCatalog).some(error => /graph capacity|max nodes|16/i.test(error)),
    true
);

assert.equal(
    validateGraph(createGraphState({
        nodes: Array.from({ length: 16 }, (_, index) => ({
            node_id: `n${index}`,
            block_id: 'representation.vector_magnitude',
            params: {}
        })),
        connections: Array.from({ length: 21 }, (_, index) => ({
            source: `n${index % 16}.primary`,
            target: `n${index % 16}.primary`
        })),
        outputs: {}
    }), unconstrainedCatalog).some(error => /graph capacity|max edges|20/i.test(error)),
    true
);
