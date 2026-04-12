# Flow Builder Managed Source UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible source/axis node editing model with one permanent `Source` block while keeping the saved graph, preview execution, and upload pipeline explicit as `source.* -> representation.select_axis`.

**Architecture:** Add one focused helper module that owns the managed-source invariant, firmware-backed option lists, and synchronization between the visible `Source` block and the hidden source/axis nodes. Then update the builder viewmodel and page renderer so the palette hides source/axis blocks, the canvas renders a permanent `Source` system block, and incompatible saved graphs fail early with a clear message instead of being silently rewritten.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript UMD modules, Node `assert` tests, existing VM-based page harnesses.

---

## File Map

- Create: `flow-builder/src/flow-managed-source.js`
  Responsibility: own managed-source defaults, firmware-backed option lists, hidden-node discovery, empty-graph seeding, source switching, and compatibility validation.
- Modify: `flow-builder/src/flow-builder-viewmodel.js`
  Responsibility: hide the managed source/axis nodes from normal node cards, hide source/axis/vector blocks from the palette, and return a `systemSourceCard` model for the permanent visible block.
- Modify: `flow-builder/src/flow.js`
  Responsibility: initialize the managed source pair on load, render the permanent `Source` system block, route visible control changes into hidden graph updates, and block run/upload when the stored graph is incompatible.
- Modify: `flow-builder/index.html`
  Responsibility: load `flow-managed-source.js` before the modules that consume it.
- Modify: `flow-builder/flow.css`
  Responsibility: size and style the permanent `Source` system block without changing the rest of the canvas layout.
- Create: `tests/flow-managed-source.test.js`
  Responsibility: unit coverage for default graph seeding, explicit-graph inspection, source switching coercion, firmware-backed options, and invalid topology rejection.
- Modify: `tests/flow-builder-viewmodel.test.js`
  Responsibility: verify palette filtering, hidden-node filtering, and `systemSourceCard` generation.
- Modify: `tests/flow-builder-page.test.js`
  Responsibility: verify the new script include and that the static page still exposes the expected execution output layout.
- Modify: `tests/flow-builder-catalog-load.test.js`
  Responsibility: verify page boot renders the permanent `Source` block, seeds a default managed graph, and removes source/axis/vector entries from the palette.
- Modify: `tests/flow-builder-replay-page.test.js`
  Responsibility: verify replay still runs through the hidden explicit graph while the user only sees the permanent `Source` block.
- Create: `tests/flow-builder-managed-source-guard.test.js`
  Responsibility: verify incompatible saved graphs produce a clear page-level error and disable run/upload.

## Guardrails

- Keep the hidden graph explicit. Do not introduce compiler-side or runtime-side implicit axis selection.
- Keep the source option lists local to the new helper module for this change, but pin them with tests that mirror the verified firmware caps.
- Default a brand-new empty graph to `source.polar -> representation.select_axis(z)` so the page always has one visible `Source` block and stays aligned with the replay fixture.
- Reject ambiguous saved graphs. Do not auto-migrate multi-source or vector-magnitude graphs in this plan.

### Task 1: Add the managed-source helper with test-first coverage

**Files:**
- Create: `tests/flow-managed-source.test.js`
- Create: `flow-builder/src/flow-managed-source.js`

- [ ] **Step 1: Write the failing managed-source helper test**

```js
const assert = require('node:assert/strict');

const {
    SOURCE_CONFIG,
    ensureManagedSourceGraph,
    inspectManagedSourceGraph,
    applyManagedSourceSelection,
    getHiddenPaletteBlockIds
} = require('../flow-builder/src/flow-managed-source.js');
const { createGraphState } = require('../flow-builder/src/flow-graph.js');

function test_empty_graph_seeds_default_polar_source_and_axis() {
    const graph = ensureManagedSourceGraph(createGraphState());
    const managed = inspectManagedSourceGraph(graph);

    assert.equal(managed.source.block_id, 'source.polar');
    assert.equal(managed.axis.params.axis, 'z');
    assert.deepStrictEqual(managed.selection, {
        source: 'source.polar',
        sample_rate_hz: 52,
        resolution: 16,
        axis: 'z'
    });
    assert.deepStrictEqual(graph.connections, [
        {
            source: `${managed.source.node_id}.primary`,
            source_socket: 0,
            target: `${managed.axis.node_id}.source`,
            target_socket: 0
        }
    ]);
}

function test_apply_managed_source_selection_switches_source_and_coerces_defaults() {
    const seeded = ensureManagedSourceGraph(createGraphState());
    const updated = applyManagedSourceSelection(seeded, {
        source: 'source.lis3dh',
        axis: 'y'
    });
    const managed = inspectManagedSourceGraph(updated);

    assert.equal(managed.source.block_id, 'source.lis3dh');
    assert.deepStrictEqual(managed.selection, {
        source: 'source.lis3dh',
        sample_rate_hz: 100,
        resolution: 12,
        axis: 'y'
    });
    assert.deepStrictEqual(managed.options.sample_rate_hz, [1, 10, 25, 50, 100, 200, 400]);
    assert.deepStrictEqual(managed.options.resolution, [8, 10, 12]);
}

function test_hidden_palette_ids_match_managed_ui_contract() {
    assert.deepStrictEqual(getHiddenPaletteBlockIds(), [
        'source.lis3dh',
        'source.mpu6050',
        'source.polar',
        'representation.select_axis',
        'representation.vector_magnitude'
    ]);
    assert.deepStrictEqual(SOURCE_CONFIG['source.mpu6050'].sample_rate_hz, [4, 10, 25, 50, 100, 200, 400, 1000]);
}

function test_multiple_sources_are_rejected() {
    assert.throws(() => ensureManagedSourceGraph(createGraphState({
        nodes: [
            { node_id: 'src1', block_id: 'source.lis3dh', params: { sample_rate_hz: 100, resolution: 12 } },
            { node_id: 'src2', block_id: 'source.polar', params: { sample_rate_hz: 52 } },
            { node_id: 'axis', block_id: 'representation.select_axis', params: { axis: 'z' } }
        ],
        connections: [
            { source: 'src1.primary', source_socket: 0, target: 'axis.source', target_socket: 0 }
        ]
    })), /exactly one source/i);
}

test_empty_graph_seeds_default_polar_source_and_axis();
test_apply_managed_source_selection_switches_source_and_coerces_defaults();
test_hidden_palette_ids_match_managed_ui_contract();
test_multiple_sources_are_rejected();
console.log('managed source helper tests passed');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/flow-managed-source.test.js`

Expected: FAIL because `../flow-builder/src/flow-managed-source.js` does not exist yet.

- [ ] **Step 3: Implement the minimal managed-source helper**

```js
(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowManagedSource = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SOURCE_CONFIG = {
        'source.lis3dh': {
            label: 'LIS3DH',
            sample_rate_hz: [1, 10, 25, 50, 100, 200, 400],
            resolution: [8, 10, 12],
            default_sample_rate_hz: 100,
            default_resolution: 12
        },
        'source.mpu6050': {
            label: 'MPU6050',
            sample_rate_hz: [4, 10, 25, 50, 100, 200, 400, 1000],
            resolution: [16],
            default_sample_rate_hz: 100,
            default_resolution: 16
        },
        'source.polar': {
            label: 'Polar',
            sample_rate_hz: [52],
            resolution: [16],
            default_sample_rate_hz: 52,
            default_resolution: 16
        }
    };
    const AXIS_OPTIONS = ['x', 'y', 'z'];
    const HIDDEN_PALETTE_BLOCK_IDS = [
        'source.lis3dh',
        'source.mpu6050',
        'source.polar',
        'representation.select_axis',
        'representation.vector_magnitude'
    ];
    const DEFAULT_SOURCE_NODE_ID = 'managed_source';
    const DEFAULT_AXIS_NODE_ID = 'managed_axis';

    function cloneGraph(graph) {
        return JSON.parse(JSON.stringify(graph || {}));
    }

    function getSourceNodes(graph) {
        return (graph.nodes || []).filter(node => Object.prototype.hasOwnProperty.call(SOURCE_CONFIG, node.block_id));
    }

    function findAxisNodeForSource(graph, sourceNodeId) {
        const axisNodes = (graph.nodes || []).filter(node => node.block_id === 'representation.select_axis');
        return axisNodes.find(node => (graph.connections || []).some(connection => (
            connection.source === `${sourceNodeId}.primary` &&
            connection.target === `${node.node_id}.source`
        ))) || null;
    }

    function buildSelection(sourceNode, axisNode) {
        const sourceConfig = SOURCE_CONFIG[sourceNode.block_id];
        return {
            source: sourceNode.block_id,
            sample_rate_hz: sourceNode.params.sample_rate_hz ?? sourceConfig.default_sample_rate_hz,
            resolution: sourceNode.params.resolution ?? sourceConfig.default_resolution,
            axis: axisNode.params.axis || 'z'
        };
    }

    function inspectManagedSourceGraph(graph) {
        const sourceNodes = getSourceNodes(graph);
        if (sourceNodes.length !== 1) {
            throw new Error('managed source UI requires exactly one source node');
        }

        const sourceNode = sourceNodes[0];
        const axisNode = findAxisNodeForSource(graph, sourceNode.node_id);
        if (!axisNode) {
            throw new Error('managed source UI requires exactly one select-axis node connected to the source');
        }

        return {
            source: sourceNode,
            axis: axisNode,
            selection: buildSelection(sourceNode, axisNode),
            options: {
                source: Object.keys(SOURCE_CONFIG),
                sample_rate_hz: SOURCE_CONFIG[sourceNode.block_id].sample_rate_hz.slice(),
                resolution: SOURCE_CONFIG[sourceNode.block_id].resolution.slice(),
                axis: AXIS_OPTIONS.slice()
            },
            outputRef: `${axisNode.node_id}.primary`,
            hiddenNodeIds: [sourceNode.node_id, axisNode.node_id]
        };
    }

    function ensureManagedSourceGraph(graph) {
        const nextGraph = cloneGraph(graph);
        nextGraph.nodes = Array.isArray(nextGraph.nodes) ? nextGraph.nodes : [];
        nextGraph.connections = Array.isArray(nextGraph.connections) ? nextGraph.connections : [];

        if (nextGraph.nodes.length === 0) {
            nextGraph.nodes.push(
                {
                    node_id: DEFAULT_SOURCE_NODE_ID,
                    block_id: 'source.polar',
                    params: { sample_rate_hz: 52, resolution: 16 },
                    ui: { position: { x: 120, y: 120 }, output_slots: { primary: 1 } }
                },
                {
                    node_id: DEFAULT_AXIS_NODE_ID,
                    block_id: 'representation.select_axis',
                    params: { axis: 'z' },
                    ui: { position: { x: 380, y: 120 }, input_slots: {}, output_slots: { primary: 1 } }
                }
            );
            nextGraph.connections.push({
                source: `${DEFAULT_SOURCE_NODE_ID}.primary`,
                source_socket: 0,
                target: `${DEFAULT_AXIS_NODE_ID}.source`,
                target_socket: 0
            });
        }

        inspectManagedSourceGraph(nextGraph);
        return nextGraph;
    }

    function applyManagedSourceSelection(graph, partialSelection) {
        const nextGraph = ensureManagedSourceGraph(graph);
        const managed = inspectManagedSourceGraph(nextGraph);
        const nextSourceBlockId = partialSelection.source || managed.selection.source;
        const sourceConfig = SOURCE_CONFIG[nextSourceBlockId];
        const nextAxis = AXIS_OPTIONS.includes(partialSelection.axis) ? partialSelection.axis : managed.selection.axis;
        const nextSampleRate = sourceConfig.sample_rate_hz.includes(Number(partialSelection.sample_rate_hz))
            ? Number(partialSelection.sample_rate_hz)
            : (sourceConfig.sample_rate_hz.includes(Number(managed.selection.sample_rate_hz))
                ? Number(managed.selection.sample_rate_hz)
                : sourceConfig.default_sample_rate_hz);
        const nextResolution = sourceConfig.resolution.includes(Number(partialSelection.resolution))
            ? Number(partialSelection.resolution)
            : (sourceConfig.resolution.includes(Number(managed.selection.resolution))
                ? Number(managed.selection.resolution)
                : sourceConfig.default_resolution);

        managed.source.block_id = nextSourceBlockId;
        managed.source.params = {
            ...managed.source.params,
            sample_rate_hz: nextSampleRate,
            resolution: nextResolution
        };
        managed.axis.params = {
            ...managed.axis.params,
            axis: AXIS_OPTIONS.includes(nextAxis) ? nextAxis : 'z'
        };

        return nextGraph;
    }

    function getHiddenPaletteBlockIds() {
        return HIDDEN_PALETTE_BLOCK_IDS.slice();
    }

    return {
        SOURCE_CONFIG,
        AXIS_OPTIONS,
        ensureManagedSourceGraph,
        inspectManagedSourceGraph,
        applyManagedSourceSelection,
        getHiddenPaletteBlockIds
    };
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/flow-managed-source.test.js`

Expected: PASS with `managed source helper tests passed`.

- [ ] **Step 5: Commit**

```bash
git add tests/flow-managed-source.test.js flow-builder/src/flow-managed-source.js
git commit -m "feat: add managed source graph helper"
```

### Task 2: Teach the viewmodel to hide internal nodes and expose a system source card

**Files:**
- Modify: `flow-builder/src/flow-builder-viewmodel.js`
- Modify: `tests/flow-builder-viewmodel.test.js`

- [ ] **Step 1: Extend the failing viewmodel test**

```js
const assert = require('node:assert/strict');

const { createBuilderViewModel } = require('../flow-builder/src/flow-builder-viewmodel.js');

const catalog = {
    blocks: [
        {
            block_id: 'source.polar',
            group: 'source',
            inputs: [],
            outputs: [{ name: 'primary', kind: 'raw_window' }]
        },
        {
            block_id: 'representation.select_axis',
            group: 'representation',
            inputs: [{ name: 'source', kinds: ['raw_window'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'series' }]
        },
        {
            block_id: 'representation.vector_magnitude',
            group: 'representation',
            inputs: [{ name: 'source', kinds: ['raw_window'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'series' }]
        },
        {
            block_id: 'pretraitement.hpf_gravity',
            group: 'pretraitement',
            inputs: [{ name: 'source', kinds: ['series'], cardinality: 'one' }],
            outputs: [{ name: 'primary', kind: 'series' }]
        }
    ]
};

const model = createBuilderViewModel({
    catalog,
    graph: {
        schema_version: 2,
        nodes: [
            { node_id: 'src', block_id: 'source.polar', params: { sample_rate_hz: 52, resolution: 16 } },
            { node_id: 'axis', block_id: 'representation.select_axis', params: { axis: 'z' } },
            { node_id: 'hpf', block_id: 'pretraitement.hpf_gravity', params: { cutoff_hz: 1 } }
        ],
        connections: [
            { source: 'src.primary', source_socket: 0, target: 'axis.source', target_socket: 0 },
            { source: 'axis.primary', source_socket: 0, target: 'hpf.source', target_socket: 0 }
        ],
        outputs: {}
    },
    selection: { activeSourcePort: 'axis.primary' }
});

assert.deepStrictEqual(model.paletteGroups.map(group => group.group), ['pretraitement']);
assert.deepStrictEqual(model.nodeCards.map(card => card.node_id), ['hpf']);
assert.equal(model.systemSourceCard.title, 'Source');
assert.equal(model.systemSourceCard.output.ref, 'axis.primary');
assert.equal(model.systemSourceCard.output.kind, 'series');
assert.deepStrictEqual(model.systemSourceCard.fields.find(field => field.name === 'sample_rate_hz').options, [52]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/flow-builder-viewmodel.test.js`

Expected: FAIL because the current viewmodel still returns source/axis blocks in the palette and still renders the hidden nodes as normal canvas cards.

- [ ] **Step 3: Implement the minimal viewmodel changes**

```js
(function(root, factory) {
    const api = factory(
        (typeof module === 'object' && module.exports)
            ? require('./flow-managed-source.js')
            : root.FlowManagedSource
    );

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowBuilderViewModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(FlowManagedSource) {
    const GROUP_ORDER = ['source', 'representation', 'pretraitement', 'estimation', 'detection', 'validation', 'suivi'];

    function buildSystemSourceCard(graph) {
        const managed = FlowManagedSource.inspectManagedSourceGraph(graph);
        return {
            title: 'Source',
            selection: managed.selection,
            fields: [
                { name: 'source', value: managed.selection.source, options: managed.options.source },
                { name: 'sample_rate_hz', value: managed.selection.sample_rate_hz, options: managed.options.sample_rate_hz },
                { name: 'resolution', value: managed.selection.resolution, options: managed.options.resolution },
                { name: 'axis', value: managed.selection.axis, options: managed.options.axis }
            ],
            output: {
                ref: managed.outputRef,
                kind: 'series',
                name: 'primary'
            },
            hiddenNodeIds: new Set(managed.hiddenNodeIds)
        };
    }

    function createBuilderViewModel({ catalog, graph, selection }) {
        const blocks = getBlockList(catalog);
        const hiddenPaletteIds = new Set(FlowManagedSource.getHiddenPaletteBlockIds());
        const systemSourceCard = buildSystemSourceCard(graph);
        const paletteGroups = GROUP_ORDER
            .map(group => ({
                group,
                blocks: blocks.filter(block => block.group === group && !hiddenPaletteIds.has(block.block_id))
            }))
            .filter(group => group.blocks.length > 0);
        const hiddenNodeIds = systemSourceCard.hiddenNodeIds;
        const graphNodes = Array.isArray(graph && graph.nodes)
            ? graph.nodes.filter(node => !hiddenNodeIds.has(node.node_id))
            : [];
        const activeSourcePort = selection && selection.activeSourcePort
            ? selection.activeSourcePort
            : null;
        const activeCatalog = {
            ...(catalog || {}),
            graphNodes
        };
        const activeKind = activeSourcePort ? findActiveOutputKind(activeCatalog, activeSourcePort) : null;
        const sourceConnections = indexConnectionsBySocket(graph && graph.connections, 'source', 'source_socket');
        const targetConnections = indexConnectionsBySocket(graph && graph.connections, 'target', 'target_socket');
        const nodeCards = graphNodes.map((node, index) => {
            const block = getBlockById(catalog).get(node.block_id) || { inputs: [], outputs: [] };
            const inputPorts = createInputPorts({
                graph,
                node,
                block,
                activeKind,
                targetConnections
            });
            const outputPorts = createOutputPorts({
                graph,
                node,
                block,
                activeSourcePort,
                sourceConnections
            });

            return {
                node_id: node.node_id,
                title: node.block_id,
                block_id: node.block_id,
                params: node.params || {},
                position: getNodePosition(node, index),
                inputs: inputPorts,
                outputs: outputPorts,
                inputPorts,
                outputPorts
            };
        });

        return {
            paletteGroups,
            systemSourceCard,
            nodeCards
        };
    }

    return { createBuilderViewModel };
}));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node tests/flow-managed-source.test.js
node tests/flow-builder-viewmodel.test.js
```

Expected: both PASS, with the viewmodel test confirming that only downstream DSP blocks remain visible.

- [ ] **Step 5: Commit**

```bash
git add flow-builder/src/flow-builder-viewmodel.js tests/flow-builder-viewmodel.test.js
git commit -m "feat: hide managed source nodes from the builder"
```

### Task 3: Render the permanent Source block and wire its controls into the hidden graph

**Files:**
- Modify: `flow-builder/index.html`
- Modify: `flow-builder/src/flow.js`
- Modify: `flow-builder/flow.css`
- Modify: `tests/flow-builder-page.test.js`
- Modify: `tests/flow-builder-catalog-load.test.js`
- Modify: `tests/flow-builder-replay-page.test.js`

- [ ] **Step 1: Update the page tests first**

```js
// tests/flow-builder-page.test.js
assert.match(html, /<script src="src\/flow-managed-source\.js"><\/script>/);

// tests/flow-builder-catalog-load.test.js
assert.equal(
    elements.get('catalog-status').textContent,
    'Catalog ready',
    'catalog should still load successfully when fetch is blocked'
);
assert.match(elements.get('blocks-layer').innerHTML, /data-system-node="source"/);
assert.match(elements.get('blocks-layer').innerHTML, />Source</);
assert.doesNotMatch(elements.get('palette-groups').innerHTML, /source\.lis3dh/);
assert.doesNotMatch(elements.get('palette-groups').innerHTML, /representation\.select_axis/);
assert.doesNotMatch(elements.get('palette-groups').innerHTML, /representation\.vector_magnitude/);
assert.match(elements.get('palette-groups').innerHTML, /pretraitement\.hpf_gravity/);

// tests/flow-builder-replay-page.test.js
assert.match(elements.get('blocks-layer').innerHTML, /data-system-node="source"/);
assert.doesNotMatch(elements.get('blocks-layer').innerHTML, /source\.polar/);
assert.doesNotMatch(elements.get('blocks-layer').innerHTML, /representation\.select_axis/);
assert.equal(replayCallCount, 2, 'replay run should execute once per CSV row');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node tests/flow-builder-page.test.js
node tests/flow-builder-catalog-load.test.js
node tests/flow-builder-replay-page.test.js
```

Expected: FAIL because the page does not yet load `flow-managed-source.js`, does not render a permanent `Source` system block, and still renders source/axis blocks directly from the graph.

- [ ] **Step 3: Implement the permanent Source system block**

```html
<!-- flow-builder/index.html -->
<script src="src/flow-managed-source.js"></script>
<script src="src/flow-builder-viewmodel.js"></script>
```

```js
// flow-builder/src/flow.js
let catalog = null;
let managedSourceError = null;
let graph = FlowGraph.createGraphState(loadStoredGraph());

function initializeManagedSourceGraph() {
    graph = FlowManagedSource.ensureManagedSourceGraph(graph);
}

function getSystemNodePosition(kind) {
    ensureGraphUi();

    const stored = graph.ui.system_nodes[kind];
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
        return stored;
    }

    if (kind === 'source') {
        return { x: 36, y: 120 };
    }

    return clampPosition({ x: getCanvasBounds().width - 240, y: 220 }, { width: 200, height: 120 });
}

function renderSystemSourceBlock(card) {
    const position = getSystemNodePosition('source');

    return `
        <article
            class="canvas-block system-block system-block-source"
            data-system-node="source"
            style="left:${position.x}px; top:${position.y}px;"
        >
            <div class="block-header" data-drag-kind="system" data-system-kind="source">
                <span>${escapeHtml(card.title)}</span>
            </div>
            <div class="block-body">
                <div class="block-content">
                    ${card.fields.map(field => `
                        <label class="param-field">
                            <span>${escapeHtml(field.name)}</span>
                            <select class="block-select" data-managed-source-param="${escapeHtml(field.name)}">
                                ${field.options.map(option => `
                                    <option value="${escapeHtml(option)}" ${String(field.value) === String(option) ? 'selected' : ''}>
                                        ${escapeHtml(option)}
                                    </option>
                                `).join('')}
                            </select>
                        </label>
                    `).join('')}
                </div>
                <div class="port-side port-side-right">
                    <div class="port-group port-group-output">
                        <div class="port-group-label">${escapeHtml(card.output.name)}</div>
                        <div class="ports-stack ports-stack-output">
                            <button
                                type="button"
                                class="port port-kind-series"
                                data-port-side="output"
                                data-ref="${escapeHtml(card.output.ref)}"
                                data-port-name="${escapeHtml(card.output.name)}"
                                data-socket-index="0"
                                data-kind="${escapeHtml(card.output.kind)}"
                                title="${escapeHtml(card.output.name)}"
                            ></button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function applyManagedSourceParam(paramName, rawValue) {
    graph = FlowManagedSource.applyManagedSourceSelection(graph, { [paramName]: rawValue });
    markGraphDirty();
}

function renderBlocks(model) {
    const nodeMarkup = model.nodeCards.map(card => {
        const block = findBlock(card.block_id) || { params: [] };

        return `
            <article
                class="canvas-block"
                data-node-id="${escapeHtml(card.node_id)}"
                style="left:${card.position.x}px; top:${card.position.y}px;"
            >
                <div class="block-header" data-drag-kind="node" data-node-id="${escapeHtml(card.node_id)}">
                    <span>${escapeHtml(card.title)}</span>
                    <button class="delete-btn" type="button" data-delete-node="${escapeHtml(card.node_id)}">×</button>
                </div>
                <div class="block-body">
                    <div class="port-side port-side-left">
                        ${renderInputPortGroups(card.node_id, card.inputPorts || [])}
                    </div>
                    <div class="block-content">
                        ${renderParamControls(card, block)}
                    </div>
                    <div class="port-side port-side-right">
                        ${renderOutputPortGroups(card.node_id, card.outputPorts || [])}
                    </div>
                </div>
            </article>
        `;
    }).join('');
    const emptyState = model.nodeCards.length === 0
        ? `<div class="empty-state">Drag blocks into the canvas, move them around, then connect sockets manually.</div>`
        : '';

    blocksLayer.innerHTML = `
        ${renderSystemSourceBlock(model.systemSourceCard)}
        ${renderSystemOutputBlock()}
        ${emptyState}
        ${nodeMarkup}
    `;
}

blocksLayer.querySelectorAll('[data-managed-source-param]').forEach(control => {
    control.addEventListener('change', () => {
        applyManagedSourceParam(
            control.getAttribute('data-managed-source-param'),
            control.value
        );
    });
});

catalog = await FlowCatalog.loadCatalog();
initializeManagedSourceGraph();
render();
```

```css
/* flow-builder/flow.css */
.system-block-source {
    min-width: 260px;
    min-height: 156px;
}

.system-block-source .block-body {
    min-height: 118px;
}

.system-block-source .block-content {
    min-width: 150px;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node tests/flow-builder-page.test.js
node tests/flow-builder-catalog-load.test.js
node tests/flow-builder-replay-page.test.js
```

Expected: PASS, with the page boot tests showing the permanent `Source` block and the replay-page test still exercising the hidden explicit graph successfully.

- [ ] **Step 5: Commit**

```bash
git add flow-builder/index.html flow-builder/src/flow.js flow-builder/flow.css tests/flow-builder-page.test.js tests/flow-builder-catalog-load.test.js tests/flow-builder-replay-page.test.js
git commit -m "feat: render permanent managed source block"
```

### Task 4: Block incompatible saved graphs and surface a clear page-level error

**Files:**
- Create: `tests/flow-builder-managed-source-guard.test.js`
- Modify: `flow-builder/src/flow.js`

- [ ] **Step 1: Write the failing page guard test**

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const flowBuilderDir = path.join(rootDir, 'flow-builder');
const html = fs.readFileSync(path.join(flowBuilderDir, 'index.html'), 'utf8');
const storedGraph = JSON.stringify({
    schema_version: 2,
    nodes: [
        { node_id: 'src1', block_id: 'source.lis3dh', params: { sample_rate_hz: 100, resolution: 12 } },
        { node_id: 'src2', block_id: 'source.polar', params: { sample_rate_hz: 52, resolution: 16 } },
        { node_id: 'axis', block_id: 'representation.select_axis', params: { axis: 'z' } }
    ],
    connections: [
        { source: 'src1.primary', source_socket: 0, target: 'axis.source', target_socket: 0 }
    ],
    outputs: {}
});

function extractScriptSrcs(source) {
    return Array.from(source.matchAll(/<script\s+src="([^"]+)"><\/script>/g), match => match[1]);
}

function createClassList() {
    const classes = new Set();

    return {
        add(...tokens) {
            for (const token of tokens) classes.add(token);
        },
        remove(...tokens) {
            for (const token of tokens) classes.delete(token);
        },
        contains(token) {
            return classes.has(token);
        }
    };
}

function createElement(id = '') {
    const listeners = new Map();
    const attributes = new Map();

    return {
        id,
        dataset: {},
        style: {},
        innerHTML: '',
        textContent: '',
        disabled: false,
        clientWidth: 1280,
        clientHeight: 720,
        offsetWidth: 260,
        offsetHeight: 180,
        classList: createClassList(),
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        async dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) {
                await handler(event);
            }
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        closest() { return null; },
        appendChild() {},
        setAttribute(name, value) { attributes.set(name, value); },
        getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
        }
    };
}

function createTestDocument() {
    const listeners = new Map();
    const elements = new Map([
        ['palette-groups', createElement('palette-groups')],
        ['blocks-layer', createElement('blocks-layer')],
        ['wires-layer', createElement('wires-layer')],
        ['graph-output-list', createElement('graph-output-list')],
        ['runtime-diagnostics', createElement('runtime-diagnostics')],
        ['catalog-status', createElement('catalog-status')],
        ['run-sim-btn', createElement('run-sim-btn')],
        ['upload-pipeline-btn', createElement('upload-pipeline-btn')],
        ['upload-progress', createElement('upload-progress')],
        ['upload-status', createElement('upload-status')],
        ['canvas', createElement('canvas')],
        ['dsp-sidebar', createElement('dsp-sidebar')],
        ['execution-console', createElement('execution-console')],
        ['sidebar-dock-btn', createElement('sidebar-dock-btn')],
        ['console-dock-btn', createElement('console-dock-btn')],
        ['cadence-chart', createElement('cadence-chart')],
        ['replay-status', createElement('replay-status')]
    ]);

    return {
        document: {
            getElementById(id) {
                return elements.get(id) || null;
            },
            addEventListener(type, handler) {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type).push(handler);
            },
            createElementNS() {
                return createElement();
            }
        },
        elements,
        listeners
    };
}

async function main() {
    const scriptSrcs = extractScriptSrcs(html);
    const flowScriptSrcs = scriptSrcs.filter(src => src === 'assets/flow-block-catalog.js' || src.startsWith('src/'));
    const { document, elements, listeners } = createTestDocument();
    const context = {
        console,
        document,
        window: {
            addEventListener() {}
        },
        localStorage: {
            getItem() {
                return storedGraph;
            },
            setItem() {}
        },
        setTimeout(handler) {
            handler();
            return 0;
        },
        clearTimeout() {},
        fetch: async () => {
            throw new Error('fetch blocked');
        }
    };

    context.globalThis = context;
    vm.createContext(context);

    for (const src of flowScriptSrcs) {
        const scriptPath = path.join(flowBuilderDir, src);
        const script = fs.readFileSync(scriptPath, 'utf8');
        vm.runInContext(script, context, { filename: scriptPath });
    }

    const domContentLoadedHandlers = listeners.get('DOMContentLoaded') || [];
    await domContentLoadedHandlers[0]();

    assert.equal(elements.get('run-sim-btn').disabled, true);
    assert.equal(elements.get('upload-pipeline-btn').disabled, true);
    assert.match(elements.get('runtime-diagnostics').textContent, /exactly one source node/i);
    assert.match(elements.get('blocks-layer').innerHTML, /Managed source graph is incompatible/i);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/flow-builder-managed-source-guard.test.js`

Expected: FAIL because the page currently accepts the incompatible graph and does not disable run/upload or render a managed-source-specific error.

- [ ] **Step 3: Implement the minimal guardrails in the page**

```js
// flow-builder/src/flow.js
let managedSourceError = null;

function initializeManagedSourceGraph() {
    try {
        graph = FlowManagedSource.ensureManagedSourceGraph(FlowGraph.createGraphState(loadStoredGraph()));
        managedSourceError = null;
    } catch (error) {
        graph = FlowGraph.createGraphState(loadStoredGraph());
        managedSourceError = error && error.message ? error.message : 'Managed source graph is incompatible.';
    }
}

function renderSystemSourceBlock(card) {
    const position = getSystemNodePosition('source');

    if (managedSourceError) {
        return `
            <article
                class="canvas-block system-block system-block-source"
                data-system-node="source"
                style="left:${position.x}px; top:${position.y}px;"
            >
                <div class="block-header" data-drag-kind="system" data-system-kind="source">
                    <span>Source</span>
                </div>
                <div class="block-body">
                    <div class="block-content system-block-content">
                        <p>Managed source graph is incompatible.</p>
                        <p>${escapeHtml(managedSourceError)}</p>
                    </div>
                </div>
            </article>
        `;
    }

    return `
        <article
            class="canvas-block system-block system-block-source"
            data-system-node="source"
            style="left:${position.x}px; top:${position.y}px;"
        >
            <div class="block-header" data-drag-kind="system" data-system-kind="source">
                <span>${escapeHtml(card.title)}</span>
            </div>
            <div class="block-body">
                <div class="block-content">
                    ${card.fields.map(field => `
                        <label class="param-field">
                            <span>${escapeHtml(field.name)}</span>
                            <select class="block-select" data-managed-source-param="${escapeHtml(field.name)}">
                                ${field.options.map(option => `
                                    <option value="${escapeHtml(option)}" ${String(field.value) === String(option) ? 'selected' : ''}>
                                        ${escapeHtml(option)}
                                    </option>
                                `).join('')}
                            </select>
                        </label>
                    `).join('')}
                </div>
                <div class="port-side port-side-right">
                    <div class="port-group port-group-output">
                        <div class="port-group-label">${escapeHtml(card.output.name)}</div>
                        <div class="ports-stack ports-stack-output">
                            <button
                                type="button"
                                class="port port-kind-series"
                                data-port-side="output"
                                data-ref="${escapeHtml(card.output.ref)}"
                                data-port-name="${escapeHtml(card.output.name)}"
                                data-socket-index="0"
                                data-kind="${escapeHtml(card.output.kind)}"
                                title="${escapeHtml(card.output.name)}"
                            ></button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function syncManagedSourceErrorState() {
    if (!managedSourceError) {
        runButton.disabled = false;
        if (uploadButton) {
            uploadButton.disabled = false;
        }
        return;
    }

    runButton.disabled = true;
    if (uploadButton) {
        uploadButton.disabled = true;
    }
    diagnosticsNode.textContent = JSON.stringify({ error: managedSourceError }, null, 2);
    setStatus('flow-run-invalid', 'Managed source graph is incompatible.');
}

// During startup, after catalog load:
initializeManagedSourceGraph();
syncManagedSourceErrorState();
render();

// In run/upload handlers:
if (managedSourceError) {
    diagnosticsNode.textContent = JSON.stringify({ error: managedSourceError }, null, 2);
    setStatus('flow-run-invalid', 'Managed source graph is incompatible.');
    return;
}
```

- [ ] **Step 4: Run the guard and regression tests to verify they pass**

Run:

```bash
node tests/flow-managed-source.test.js
node tests/flow-builder-viewmodel.test.js
node tests/flow-builder-page.test.js
node tests/flow-builder-catalog-load.test.js
node tests/flow-builder-replay-page.test.js
node tests/flow-builder-managed-source-guard.test.js
```

Expected: PASS, with the new guard test proving that incompatible stored graphs fail early while the previously working replay page path still passes.

- [ ] **Step 5: Commit**

```bash
git add flow-builder/src/flow.js tests/flow-builder-managed-source-guard.test.js
git commit -m "feat: guard incompatible managed source graphs"
```

## Spec Coverage Check

- Permanent visible `Source` block: Task 2 exposes the card model; Task 3 renders it.
- Hidden explicit source plus axis nodes: Task 1 owns the invariant and Task 3 keeps using the hidden output ref.
- Single-source and single-axis enforcement: Task 1 rejects incompatible graphs and Task 4 surfaces that rejection in the page.
- Firmware-backed discrete options for sample rate and resolution: Task 1 pins the option tables and source-switch coercion logic.
- Remove source/select-axis/vector-magnitude from the UI: Task 2 filters the palette and hides the internal nodes; Task 3 proves the page only shows the managed system block.
- Clear failure behavior for incompatible existing graphs: Task 4 covers the page-level guard.

## Placeholder Scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every code-changing step includes concrete snippets, file paths, and commands.
- Test commands are all explicit `node tests/<file>.js` invocations that match the current repository harness.
