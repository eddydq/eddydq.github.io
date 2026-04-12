# Flow Builder Preview Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one `Run Simulation` replay `flow-builder/logs/raw_logs/polar_log_002.csv` end-to-end and render a cadence-over-time chart inside `Execution Outputs`.

**Architecture:** Add a small replay helper module that owns three pure concerns: parsing the packed-window Polar CSV, normalizing a source-based editor graph into a preview-only `input.raw` execution graph, and running one runtime call per replay frame while collecting cadence points from the final `estimate` output. Then wire that module into `flow.js`, add a chart container to the existing execution outputs panel, and cover the flow with one unit-level Node test and one page-level VM test.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node `assert` tests, existing WASM runtime worker.

---

## File Map

- Create: `flow-builder/src/flow-replay.js`
  Responsibility: parse `polar_log_002.csv`, adapt `source.polar` preview graphs to `input.raw`, build replay packets, and collect cadence series from runtime results.
- Modify: `flow-builder/src/flow.js`
  Responsibility: load replay frames on page init, run replay sessions from the existing `Run Simulation` button, store replay state, and render the chart plus final-step JSON.
- Modify: `flow-builder/index.html`
  Responsibility: include `flow-replay.js` before `flow.js` and add explicit chart/status nodes inside the existing execution outputs region.
- Modify: `flow-builder/flow.css`
  Responsibility: style the cadence chart, empty/error states, and replay status text without changing the overall page layout.
- Create: `flow-builder/tests/flow-replay.test.js`
  Responsibility: unit coverage for CSV parsing, preview graph normalization, packet construction, and cadence-series extraction.
- Modify: `tests/flow-builder-page.test.js`
  Responsibility: static assertions for the new `flow-replay.js` script tag and chart DOM ids.
- Create: `tests/flow-builder-replay-page.test.js`
  Responsibility: VM-driven integration test proving page init loads replay data and one simulated run populates the chart and final-step JSON.

## Guardrails

- Keep the replay feature isolated from the unrelated uncommitted catalog/compiler changes already present in the worktree.
- Do not persist replay graph normalization back into local storage.
- Do not add manual CSV import in this plan.
- Treat cadence as `estimate.values[0]` from the final bound output packet.

### Task 1: Build the replay helper module with test-first coverage

**Files:**
- Create: `flow-builder/tests/flow-replay.test.js`
- Create: `flow-builder/src/flow-replay.js`

- [ ] **Step 1: Write the failing replay helper test**

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node flow-builder/tests/flow-replay.test.js`

Expected: FAIL because `../src/flow-replay.js` does not exist yet.

- [ ] **Step 3: Implement the minimal replay helper module**

```js
(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowReplay = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const DEFAULT_REPLAY_SAMPLE_RATE_HZ = 52;

    function parsePolarReplayCsv(csvText) {
        const lines = String(csvText || '').trim().split(/\r?\n/);
        const header = lines[0].split(',');
        const xStart = header.indexOf('x_000');
        const yStart = header.indexOf('y_000');
        const zStart = header.indexOf('z_000');

        return lines.slice(1).filter(Boolean).map(line => {
            const cells = line.split(',');
            const count = Number(cells[1] || 0);

            return {
                timestamp: Number(cells[0] || 0),
                count,
                x: cells.slice(xStart, xStart + count).map(Number),
                y: cells.slice(yStart, yStart + count).map(Number),
                z: cells.slice(zStart, zStart + count).map(Number)
            };
        }).filter(frame => frame.count > 0);
    }

    function buildReplayExecutionGraph(graph) {
        const sourceNode = (graph.nodes || []).find(node => node.block_id === 'source.polar');
        if (!sourceNode) {
            throw new Error('replay preview requires one source.polar node');
        }

        return {
            ...graph,
            nodes: graph.nodes.filter(node => node.node_id !== sourceNode.node_id),
            connections: (graph.connections || [])
                .filter(connection => !connection.target.startsWith(`${sourceNode.node_id}.`))
                .map(connection => connection.source.startsWith(`${sourceNode.node_id}.`)
                    ? { ...connection, source: 'input.raw', source_socket: 0 }
                    : connection)
        };
    }

    function createReplayPacket(frame) {
        return {
            binding_name: 'raw',
            packet: {
                kind: 'raw_window',
                data: {
                    sample_rate_hz: DEFAULT_REPLAY_SAMPLE_RATE_HZ,
                    length: frame.count,
                    x: frame.x.slice(0, frame.count),
                    y: frame.y.slice(0, frame.count),
                    z: frame.z.slice(0, frame.count)
                }
            }
        };
    }

    function collectCadencePoint(timestamp, result, finalBinding) {
        const packet = result && result.outputs ? result.outputs[finalBinding] : null;
        if (!packet || packet.kind !== 'estimate' || !Array.isArray(packet.values) || packet.values.length < 1) {
            return null;
        }

        return { timestamp, cadence: packet.values[0] };
    }

    return { parsePolarReplayCsv, buildReplayExecutionGraph, createReplayPacket, collectCadencePoint };
}));
```

- [ ] **Step 4: Run the replay helper test again**

Run: `node flow-builder/tests/flow-replay.test.js`

Expected: PASS with `flow replay tests passed`.

- [ ] **Step 5: Commit the helper module**

```bash
git add flow-builder/src/flow-replay.js flow-builder/tests/flow-replay.test.js
git commit -m "feat: add flow builder replay helpers"
```

### Task 2: Add replay session execution and failure reporting

**Files:**
- Modify: `flow-builder/tests/flow-replay.test.js`
- Modify: `flow-builder/src/flow-replay.js`

- [ ] **Step 1: Extend the replay helper test with a full replay-session case**

```js
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
```

- [ ] **Step 2: Run the replay helper test to verify the new assertions fail**

Run: `node flow-builder/tests/flow-replay.test.js`

Expected: FAIL because `runReplaySession()` is not implemented yet.

- [ ] **Step 3: Implement replay session orchestration in `flow-replay.js`**

```js
async function runReplaySession({ runtime, graph, frames, finalBinding }) {
    if (!runtime || typeof runtime.runGraph !== 'function') {
        throw new Error('replay runtime is unavailable');
    }
    if (!Array.isArray(frames) || frames.length === 0) {
        throw new Error('replay CSV contained no valid rows');
    }

    const replayGraph = buildReplayExecutionGraph(graph);
    const series = [];
    let lastStepResult = null;

    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];

        try {
            lastStepResult = await runtime.runGraph({
                graph: replayGraph,
                inputs: [createReplayPacket(frame)]
            });
        } catch (error) {
            throw new Error(`replay row ${index} at ${frame.timestamp} failed: ${error.message}`);
        }

        const point = collectCadencePoint(frame.timestamp, lastStepResult, finalBinding);
        if (point) {
            series.push(point);
        }
    }

    return {
        series,
        lastStepResult,
        replayMeta: {
            frameCount: frames.length,
            sampleRateHz: DEFAULT_REPLAY_SAMPLE_RATE_HZ
        }
    };
}

return {
    parsePolarReplayCsv,
    buildReplayExecutionGraph,
    createReplayPacket,
    collectCadencePoint,
    runReplaySession
};
```

- [ ] **Step 4: Run the replay helper test again**

Run: `node flow-builder/tests/flow-replay.test.js`

Expected: PASS with all replay helper tests green.

- [ ] **Step 5: Commit the replay runner behavior**

```bash
git add flow-builder/src/flow-replay.js flow-builder/tests/flow-replay.test.js
git commit -m "feat: add flow builder replay session runner"
```

### Task 3: Wire replay loading and chart rendering into the page

**Files:**
- Modify: `flow-builder/index.html`
- Modify: `flow-builder/flow.css`
- Modify: `flow-builder/src/flow.js`
- Modify: `tests/flow-builder-page.test.js`
- Create: `tests/flow-builder-replay-page.test.js`

- [ ] **Step 1: Write the failing page tests for the replay UI and one-run chart flow**

```js
assert.match(html, /<script src="src\/flow-replay\.js"><\/script>/);
assert.match(html, /id="cadence-chart"/);
assert.match(html, /id="replay-status"/);
```

```js
const csv = [
    'timestamp,count,x_000,y_000,z_000',
    '1000,1,11,21,31',
    '1020,1,12,22,32'
].join('\\n');

context.fetch = async (url) => {
    if (String(url).includes('polar_log_002.csv')) {
        return { ok: true, text: async () => csv };
    }
    throw new Error(`unexpected fetch: ${url}`);
};

context.FlowRuntimeClient = {
    createFlowRuntimeClient() {
        return {
            async runGraph() {
                replayCallCount += 1;
                return {
                    outputs: {
                        cadence: {
                            kind: 'estimate',
                            length: 2,
                            values: [72 + replayCallCount, 99]
                        }
                    },
                    diagnostics: { nodes: [{ node_id: 'axis', status: 'ok' }] }
                };
            }
        };
    }
};

await domContentLoadedHandlers[0]();
elements.get('run-sim-btn').dispatchEvent({ type: 'click' });
await Promise.resolve();

assert.match(elements.get('cadence-chart').innerHTML, /svg/);
assert.match(elements.get('graph-output-list').textContent, /"cadence"/);
assert.match(elements.get('runtime-diagnostics').textContent, /"nodes"/);
```

- [ ] **Step 2: Run the static and page replay tests to verify they fail**

Run: `node tests/flow-builder-page.test.js`

Expected: FAIL because the replay script tag and chart ids are missing.

Run: `node tests/flow-builder-replay-page.test.js`

Expected: FAIL because the new test file and replay UI behavior do not exist yet.

- [ ] **Step 3: Implement the page integration in minimal slices**

```html
<div class="console-outputs" id="console-outputs-container">
    <section class="cadence-chart-panel">
        <div class="console-subhead">
            <h4>Cadence Over Time</h4>
            <p id="replay-status" class="replay-status">Loading replay...</p>
        </div>
        <div id="cadence-chart" class="cadence-chart">
            <p class="cadence-chart-empty">Run the replay to see cadence over time.</p>
        </div>
    </section>
    <pre id="graph-output-list" class="graph-output-list"></pre>
    <pre id="runtime-diagnostics" class="graph-output-list"></pre>
</div>
<script src="src/flow-replay.js"></script>
```

```css
.cadence-chart-panel {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 16px;
    margin-bottom: 16px;
}

.cadence-chart {
    min-height: 180px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;
}

.cadence-chart svg {
    display: block;
    width: 100%;
    height: 180px;
}

.cadence-chart-empty,
.replay-status {
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.92rem;
}
```

```js
const DEFAULT_REPLAY_PATH = 'logs/raw_logs/polar_log_002.csv';
let replayFrames = [];
let replayError = null;
let replayResult = null;
const chartNode = document.getElementById('cadence-chart');
const replayStatusNode = document.getElementById('replay-status');

async function loadReplayFrames() {
    try {
        const response = await globalThis.fetch(DEFAULT_REPLAY_PATH);
        if (!response || response.ok === false) {
            throw new Error('replay CSV fetch failed');
        }

        replayFrames = globalThis.FlowReplay.parsePolarReplayCsv(await response.text());
        if (replayFrames.length === 0) {
            throw new Error('replay CSV contained no valid rows');
        }

        replayError = null;
        replayStatusNode.textContent = `Replay ready: ${replayFrames.length} frames`;
    } catch (error) {
        replayFrames = [];
        replayError = error.message;
        replayStatusNode.textContent = error.message;
    }
}

function renderCadenceChart(series) {
    if (!chartNode) {
        return;
    }
    if (!Array.isArray(series) || series.length === 0) {
        chartNode.innerHTML = '<p class="cadence-chart-empty">No cadence estimates were produced.</p>';
        return;
    }

    const values = series.map(point => point.cadence);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const points = series.map((point, index) => {
        const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100;
        const y = max === min ? 50 : 100 - (((point.cadence - min) / (max - min)) * 100);
        return `${x},${y}`;
    }).join(' ');

    chartNode.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${points}" /></svg>`;
}

runButton.addEventListener('click', async () => {
    if (replayError) {
        diagnosticsNode.textContent = JSON.stringify({ error: replayError }, null, 2);
        return;
    }

    const result = await globalThis.FlowReplay.runReplaySession({
        runtime: getRuntime(),
        graph: FlowGraph.serializeGraph(graph),
        frames: replayFrames,
        finalBinding: FINAL_OUTPUT_BINDING
    });

    replayResult = result;
    lastRunResult = result.lastStepResult;
    renderCadenceChart(result.series);
    updatePanels();
});

await loadReplayFrames();
```

- [ ] **Step 4: Run the page tests again**

Run: `node tests/flow-builder-page.test.js`

Expected: PASS with the replay script and chart ids present.

Run: `node tests/flow-builder-replay-page.test.js`

Expected: PASS with the chart container populated and the JSON panes still showing final-step outputs and diagnostics.

- [ ] **Step 5: Commit the page integration**

```bash
git add flow-builder/index.html flow-builder/flow.css flow-builder/src/flow.js tests/flow-builder-page.test.js tests/flow-builder-replay-page.test.js
git commit -m "feat: render cadence replay chart in flow builder"
```

### Task 4: Regression verification and cleanup

**Files:**
- Test: `flow-builder/tests/flow-replay.test.js`
- Test: `tests/flow-builder-replay-page.test.js`
- Test: `tests/flow-builder-page.test.js`
- Test: `tests/flow-builder-catalog-load.test.js`
- Test: `flow-builder/tests/browser-runtime-artifact.test.js`

- [ ] **Step 1: Run the replay helper unit test**

Run: `node flow-builder/tests/flow-replay.test.js`

Expected: PASS.

- [ ] **Step 2: Run the page replay integration test**

Run: `node tests/flow-builder-replay-page.test.js`

Expected: PASS.

- [ ] **Step 3: Re-run the static page smoke test**

Run: `node tests/flow-builder-page.test.js`

Expected: PASS.

- [ ] **Step 4: Re-run the catalog fallback regression**

Run: `node tests/flow-builder-catalog-load.test.js`

Expected: PASS with `Catalog ready`.

- [ ] **Step 5: Re-run the browser runtime artifact check**

Run: `node flow-builder/tests/browser-runtime-artifact.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the verified replay feature**

```bash
git add flow-builder/src/flow-replay.js flow-builder/src/flow.js flow-builder/index.html flow-builder/flow.css flow-builder/tests/flow-replay.test.js tests/flow-builder-page.test.js tests/flow-builder-replay-page.test.js
git commit -m "feat: add replay-backed preview runs for flow builder"
```
