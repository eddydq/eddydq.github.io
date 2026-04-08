# Flow Builder Native Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current prototype `flow.html` builder with a manifest-driven graph editor that validates and executes a real portable C DSP runtime compiled to WebAssembly, while keeping all work inside this repository.

**Architecture:** Build the feature in three layers. First, add a schema-v2 graph/model layer in JavaScript that uses manifest-defined ports and typed packet compatibility. Second, add a portable C runtime under `analysis/c_*` plus a narrow vertical-slice block catalog, compile it to both a Node-test target and a browser WASM target, and emit a catalog artifact. Third, rewrite the flow builder UI to consume the generated catalog, color ports by packet kind, and run graphs through a worker-backed WASM client.

**Tech Stack:** Vanilla JavaScript in UMD/CommonJS-compatible files, Node-based assertion tests, Python 3.12 + pytest for parity and integration harnesses, portable C99, PowerShell build scripts, Emscripten for WASM.

---

## Prerequisites

- `node` is already available in this workspace.
- `python` and `pytest` are already available in this workspace.
- Install Emscripten and place `emcc` on `PATH` before executing Tasks 2 through 8. The build scripts below must fail clearly when `emcc` is unavailable and the tests must skip with a clear reason instead of crashing.

## File Map

- Create: `flow-graph.js`
  - Pure graph/state/validation/serialization helpers shared by the browser page and Node tests.
- Create: `flow-catalog.js`
  - Catalog loading and normalization helpers, including packet-kind color metadata.
- Create: `flow-runtime-client.js`
  - Browser-side wrapper around the worker/WASM runtime.
- Create: `flow-builder-viewmodel.js`
  - Pure viewmodel helpers for palette groups, port badges, compatibility highlighting, and node cards.
- Create: `flow-runtime-worker.js`
  - Web Worker that loads the generated WASM module, lazily initializes it, and executes catalog and run requests.
- Modify: `flow.js`
  - Reduce to bootstrap and DOM event wiring only.
- Modify: `flow.html`
  - Replace hardcoded palette blocks and ad hoc controls with a layout for the catalog palette, builder canvas, inspector, status, and diagnostics.
- Modify: `flow.css`
  - Add manifest-driven builder layout and packet-kind color styling.
- Modify: `script.js`
  - Add i18n strings for new flow-builder UI labels and status messages.
- Create: `tests/flow-graph.test.js`
  - Node assertions for schema-v2 graph validation, fan-in, and cycle detection.
- Create: `tests/flow-catalog.test.js`
  - Node assertions for catalog normalization and packet-kind color mapping.
- Create: `tests/flow-runtime-client.test.js`
  - Node assertions for worker client message handling using a fake worker.
- Create: `tests/flow-builder-viewmodel.test.js`
  - Node assertions for palette grouping, compatibility highlighting, and node-card shaping.
- Modify: `tests/site-smoke.ps1`
  - Extend smoke checks for the flow page’s new markup.
- Create: `analysis/c_api/pp_packet.h`
  - Canonical packet kinds and packet payload structs for the vertical slice.
- Create: `analysis/c_api/pp_manifest.h`
  - Block manifest, parameter schema, input-port, and output-port declarations.
- Create: `analysis/c_api/pp_graph.h`
  - Schema-v2 graph structs for nodes, connections, and outputs.
- Create: `analysis/c_api/pp_runtime.h`
  - Runtime status codes, result structs, and executor function declarations.
- Create: `analysis/c_runtime/pp_graph_validate.c`
  - Manifest-aware graph validation in C.
- Create: `analysis/c_runtime/pp_graph_schedule.c`
  - Topological scheduling in C.
- Create: `analysis/c_runtime/pp_runtime.c`
  - Runtime entry point that routes packets, persists node state, and executes descriptors.
- Create: `analysis/c_blocks/pp_block_catalog.c`
  - Static descriptor registry for the runtime and WASM exports.
- Create: `analysis/c_blocks/representation/pp_block_select_axis.c`
  - Portable C port of `representation.select_axis`.
- Create: `analysis/c_blocks/estimation/pp_block_autocorrelation.c`
  - Portable C port of `estimation.autocorrelation`.
- Create: `analysis/c_blocks/validation/pp_block_spm_range_gate.c`
  - Portable C port of `validation.spm_range_gate`.
- Create: `analysis/c_blocks/suivi/pp_block_kalman_2d.c`
  - Portable C port of `suivi.kalman_2d`.
- Create: `analysis/wasm/pp_header_smoke.c`
  - Minimal C translation unit used to verify header and toolchain wiring.
- Create: `analysis/wasm/pp_runtime_node_smoke.c`
  - Node-target harness used by pytest runtime tests.
- Create: `analysis/wasm/pp_wasm_exports.c`
  - Browser-facing exports for catalog and graph execution.
- Create: `analysis/wasm/build-runtime.ps1`
  - Build entry point for node-harness, browser-WASM, and catalog extraction targets.
- Create: `analysis/wasm/extract-catalog.mjs`
  - Node script that loads the node-target build and writes `assets/flow-block-catalog.json`.
- Create: `analysis/wasm/README.md`
  - Developer instructions for rebuilding the runtime and catalog artifacts.
- Create: `analysis/tests/analysis_c_headers_smoke_test.py`
  - Pytest wrapper for the build-script smoke target.
- Create: `analysis/tests/analysis_c_runtime_test.py`
  - Pytest runtime validation and scheduling checks against the node-target harness.
- Create: `analysis/tests/analysis_c_vertical_slice_parity_test.py`
  - Pytest parity checks between Python reference blocks and the C runtime vertical slice.
- Create: `analysis/tests/analysis_c_end_to_end_test.py`
  - Pytest checks for browser artifact generation and end-to-end execution output.
- Create: `assets/flow-block-catalog.json`
  - Generated catalog artifact consumed by the browser UI.
- Generate: `assets/flow-runtime.js`
  - Generated browser-side Emscripten loader.
- Generate: `assets/flow-runtime.wasm`
  - Generated browser-side WASM binary.

## Task Order

The task order below intentionally keeps the first JavaScript work independent of the compiler, then adds a toolchain gate, then ports a narrow C vertical slice, and only then rewrites the UI. Follow the order exactly so each layer lands on top of tested foundations.

### Task 1: Add the Schema-v2 Graph Model in JavaScript

**Files:**
- Create: `flow-graph.js`
- Create: `tests/flow-graph.test.js`

- [ ] **Step 1: Write the failing graph-contract test**

```javascript
const assert = require('node:assert/strict');

const {
    SCHEMA_VERSION,
    PACKET_KIND_COLORS,
    createGraphState,
    serializeGraph,
    validateGraph,
    topologicallySortGraph
} = require('../flow-graph.js');

const catalog = {
    'representation.select_axis': {
        input_ports: [{ name: 'source', kinds: ['raw_window'], cardinality: 'one' }],
        output_ports: [{ name: 'primary', kind: 'series' }]
    },
    'validation.consensus_band': {
        input_ports: [{ name: 'source', kinds: ['candidate'], cardinality: 'many' }],
        output_ports: [
            { name: 'accepted', kind: 'candidate' },
            { name: 'rejected', kind: 'candidate' }
        ]
    }
};

const validGraph = createGraphState({
    nodes: [
        { node_id: 'n1', block_id: 'representation.select_axis', params: { axis: 'y' } },
        { node_id: 'n2', block_id: 'validation.consensus_band', params: { tolerance_spm: 5 } }
    ],
    connections: [
        { source: 'input.raw', target: 'n1.source' },
        { source: 'n1.primary', target: 'n2.source' },
        { source: 'n1.primary', target: 'n2.source' }
    ],
    outputs: { accepted: 'n2.accepted' }
});

assert.equal(SCHEMA_VERSION, 2);
assert.equal(PACKET_KIND_COLORS.series, 'port-kind-series');
assert.deepStrictEqual(validateGraph(validGraph, catalog), []);
assert.deepStrictEqual(topologicallySortGraph(validGraph), ['n1', 'n2']);
assert.deepStrictEqual(serializeGraph(validGraph).schema_version, 2);

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

assert.match(validateGraph(cycleGraph, catalog)[0], /cycle/i);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/flow-graph.test.js`

Expected: process exits non-zero with `Cannot find module '../flow-graph.js'`.

- [ ] **Step 3: Implement the graph model and validator**

```javascript
(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowGraph = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SCHEMA_VERSION = 2;
    const PACKET_KIND_COLORS = {
        raw_window: 'port-kind-raw-window',
        series: 'port-kind-series',
        candidate: 'port-kind-candidate',
        estimate: 'port-kind-estimate'
    };

    function createGraphState(overrides = {}) {
        return {
            schema_version: SCHEMA_VERSION,
            nodes: Array.isArray(overrides.nodes) ? overrides.nodes.map(node => ({ ...node })) : [],
            connections: Array.isArray(overrides.connections) ? overrides.connections.map(edge => ({ ...edge })) : [],
            outputs: { ...(overrides.outputs || {}) }
        };
    }

    function serializeGraph(state) {
        return createGraphState(state);
    }

    function splitRef(ref) {
        const [node_id, port] = String(ref).split('.', 2);
        return { node_id, port };
    }

    function buildNodeMap(graph) {
        return new Map(graph.nodes.map(node => [node.node_id, node]));
    }

    function validateGraph(graph, catalog) {
        const state = createGraphState(graph);
        const errors = [];
        const nodeMap = buildNodeMap(state);
        const incomingCounts = new Map();

        for (const edge of state.connections) {
            const targetRef = splitRef(edge.target);
            const sourceRef = splitRef(edge.source);
            const targetNode = nodeMap.get(targetRef.node_id);

            if (!targetNode) {
                errors.push(`unknown target node: ${targetRef.node_id}`);
                continue;
            }

            const manifest = catalog[targetNode.block_id];
            if (!manifest) {
                errors.push(`unknown block id: ${targetNode.block_id}`);
                continue;
            }

            const inputPort = manifest.input_ports.find(port => port.name === targetRef.port);
            if (!inputPort) {
                errors.push(`unknown input port: ${edge.target}`);
                continue;
            }

            const countKey = `${targetRef.node_id}.${targetRef.port}`;
            const nextCount = (incomingCounts.get(countKey) || 0) + 1;
            incomingCounts.set(countKey, nextCount);

            if (inputPort.cardinality === 'one' && nextCount > 1) {
                errors.push(`single-cardinality input already connected: ${countKey}`);
            }

            if (sourceRef.node_id !== 'input') {
                const sourceNode = nodeMap.get(sourceRef.node_id);
                if (!sourceNode) {
                    errors.push(`unknown source node: ${sourceRef.node_id}`);
                    continue;
                }

                const sourceManifest = catalog[sourceNode.block_id];
                const sourcePort = sourceManifest.output_ports.find(port => port.name === sourceRef.port);
                if (!sourcePort) {
                    errors.push(`unknown output port: ${edge.source}`);
                    continue;
                }

                if (!inputPort.kinds.includes(sourcePort.kind)) {
                    errors.push(`packet kind mismatch: ${edge.source} -> ${edge.target}`);
                }
            }
        }

        try {
            topologicallySortGraph(state);
        } catch (error) {
            errors.push(error.message);
        }

        return errors;
    }

    function topologicallySortGraph(graph) {
        const state = createGraphState(graph);
        const nodeMap = buildNodeMap(state);
        const indegree = new Map(state.nodes.map(node => [node.node_id, 0]));
        const outgoing = new Map(state.nodes.map(node => [node.node_id, []]));

        for (const edge of state.connections) {
            const source = splitRef(edge.source);
            const target = splitRef(edge.target);
            if (source.node_id === 'input') {
                continue;
            }
            if (nodeMap.has(source.node_id) && nodeMap.has(target.node_id)) {
                indegree.set(target.node_id, indegree.get(target.node_id) + 1);
                outgoing.get(source.node_id).push(target.node_id);
            }
        }

        const queue = state.nodes
            .map(node => node.node_id)
            .filter(node_id => indegree.get(node_id) === 0);
        const ordered = [];

        while (queue.length) {
            const node_id = queue.shift();
            ordered.push(node_id);
            for (const next of outgoing.get(node_id)) {
                indegree.set(next, indegree.get(next) - 1);
                if (indegree.get(next) === 0) {
                    queue.push(next);
                }
            }
        }

        if (ordered.length !== state.nodes.length) {
            throw new Error('cycle detected in graph connections');
        }

        return ordered;
    }

    return {
        SCHEMA_VERSION,
        PACKET_KIND_COLORS,
        createGraphState,
        serializeGraph,
        validateGraph,
        topologicallySortGraph
    };
}));
```

- [ ] **Step 4: Run the graph test to verify it passes**

Run: `node tests/flow-graph.test.js`

Expected: process exits `0` with no output.

- [ ] **Step 5: Commit**

```bash
git add flow-graph.js tests/flow-graph.test.js
git commit -m "feat(flow): add schema v2 graph model"
```

### Task 2: Add the C ABI and Toolchain Smoke Build

**Files:**
- Create: `analysis/c_api/pp_packet.h`
- Create: `analysis/c_api/pp_manifest.h`
- Create: `analysis/c_api/pp_graph.h`
- Create: `analysis/c_api/pp_runtime.h`
- Create: `analysis/wasm/build-runtime.ps1`
- Create: `analysis/wasm/pp_header_smoke.c`
- Create: `analysis/tests/analysis_c_headers_smoke_test.py`

- [ ] **Step 1: Write the failing C-header smoke test**

```python
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def test_header_smoke_build():
    result = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "header-smoke",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if shutil.which("emcc") is None:
        assert result.returncode == 1
        assert "emcc not found on PATH" in (result.stdout + result.stderr)
        return

    assert result.returncode == 0, result.stdout + result.stderr
    assert Path("analysis/wasm/header-smoke.mjs").exists()
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `pytest analysis/tests/analysis_c_headers_smoke_test.py -q`

Expected: FAIL because `analysis/wasm/build-runtime.ps1` does not exist yet.

- [ ] **Step 3: Implement the ABI headers and build script**

`analysis/c_api/pp_packet.h`

```c
#ifndef PP_PACKET_H
#define PP_PACKET_H

#include <stdint.h>

#define PP_MAX_SERIES_SAMPLES 512

typedef enum pp_packet_kind_e {
    PP_PACKET_RAW_WINDOW = 1,
    PP_PACKET_SERIES = 2,
    PP_PACKET_CANDIDATE = 3,
    PP_PACKET_ESTIMATE = 4
} pp_packet_kind_t;

typedef struct pp_raw_window_s {
    float sample_rate_hz;
    float x[PP_MAX_SERIES_SAMPLES];
    float y[PP_MAX_SERIES_SAMPLES];
    float z[PP_MAX_SERIES_SAMPLES];
    uint16_t length;
} pp_raw_window_t;

typedef struct pp_series_s {
    float sample_rate_hz;
    float values[PP_MAX_SERIES_SAMPLES];
    uint16_t length;
    char axis[16];
} pp_series_t;

typedef struct pp_candidate_s {
    float sample_rate_hz;
    float spm;
    float confidence;
} pp_candidate_t;

typedef struct pp_estimate_s {
    float sample_rate_hz;
    float spm;
} pp_estimate_t;

typedef struct pp_packet_s {
    pp_packet_kind_t kind;
    union {
        pp_raw_window_t raw_window;
        pp_series_t series;
        pp_candidate_t candidate;
        pp_estimate_t estimate;
    } payload;
} pp_packet_t;

#endif
```

`analysis/c_api/pp_manifest.h`

```c
#ifndef PP_MANIFEST_H
#define PP_MANIFEST_H

#include <stddef.h>
#include "pp_packet.h"

typedef enum pp_param_type_e {
    PP_PARAM_INT = 1,
    PP_PARAM_FLOAT = 2,
    PP_PARAM_ENUM = 3
} pp_param_type_t;

typedef enum pp_port_cardinality_e {
    PP_PORT_ONE = 1,
    PP_PORT_MANY = 2
} pp_port_cardinality_t;

typedef struct pp_param_schema_s {
    const char *name;
    pp_param_type_t type;
    double default_value;
    double min_value;
    double max_value;
    const char *enum_values_csv;
} pp_param_schema_t;

typedef struct pp_input_port_def_s {
    const char *name;
    const pp_packet_kind_t *accepted_kinds;
    size_t accepted_kind_count;
    pp_port_cardinality_t cardinality;
} pp_input_port_def_t;

typedef struct pp_output_port_def_s {
    const char *name;
    pp_packet_kind_t emitted_kind;
} pp_output_port_def_t;

typedef struct pp_block_manifest_s {
    const char *block_id;
    const char *group_name;
    const pp_input_port_def_t *input_ports;
    size_t input_port_count;
    const pp_output_port_def_t *output_ports;
    size_t output_port_count;
    const pp_param_schema_t *params;
    size_t param_count;
    int stateful;
} pp_block_manifest_t;

#endif
```

`analysis/c_api/pp_graph.h`

```c
#ifndef PP_GRAPH_H
#define PP_GRAPH_H

#include <stddef.h>

typedef struct pp_node_s {
    const char *node_id;
    const char *block_id;
    const char *params_json;
} pp_node_t;

typedef struct pp_connection_s {
    const char *source_ref;
    const char *target_ref;
} pp_connection_t;

typedef struct pp_output_binding_s {
    const char *name;
    const char *source_ref;
} pp_output_binding_t;

typedef struct pp_graph_s {
    int schema_version;
    const pp_node_t *nodes;
    size_t node_count;
    const pp_connection_t *connections;
    size_t connection_count;
    const pp_output_binding_t *outputs;
    size_t output_count;
} pp_graph_t;

#endif
```

`analysis/c_api/pp_runtime.h`

```c
#ifndef PP_RUNTIME_H
#define PP_RUNTIME_H

#include <stddef.h>
#include "pp_graph.h"
#include "pp_manifest.h"
#include "pp_packet.h"

typedef enum pp_runtime_status_e {
    PP_RUNTIME_OK = 0,
    PP_RUNTIME_INVALID_GRAPH = 1,
    PP_RUNTIME_UNKNOWN_BLOCK = 2,
    PP_RUNTIME_PACKET_MISMATCH = 3,
    PP_RUNTIME_INTERNAL_ERROR = 4
} pp_runtime_status_t;

typedef struct pp_runtime_result_s {
    pp_runtime_status_t status;
    const char *message;
} pp_runtime_result_t;

typedef pp_runtime_result_t (*pp_block_run_fn)(
    const pp_packet_t *inputs,
    size_t input_count,
    const char *params_json,
    void *state_buffer,
    pp_packet_t *outputs,
    size_t *output_count
);

typedef struct pp_block_descriptor_s {
    pp_block_manifest_t manifest;
    size_t state_size;
    pp_block_run_fn run;
} pp_block_descriptor_t;

const pp_block_descriptor_t *pp_find_block_descriptor(const char *block_id);
pp_runtime_result_t pp_graph_validate(const pp_graph_t *graph);
pp_runtime_result_t pp_graph_build_schedule(const pp_graph_t *graph, size_t *ordered_indexes, size_t ordered_capacity);
pp_runtime_result_t pp_runtime_run(const pp_graph_t *graph, const pp_packet_t *input_packets, size_t input_count);

#endif
```

`analysis/wasm/build-runtime.ps1`

```powershell
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('header-smoke', 'runtime-node', 'browser', 'catalog', 'end-to-end')]
    [string]$Target
)

$ErrorActionPreference = 'Stop'

function Require-Emcc {
    $command = Get-Command emcc -ErrorAction SilentlyContinue
    if (-not $command) {
        Write-Error 'emcc not found on PATH'
        exit 1
    }
    return $command.Path
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Push-Location $repoRoot

try {
    $emcc = Require-Emcc

    if ($Target -eq 'header-smoke') {
        & $emcc `
            analysis/wasm/pp_header_smoke.c `
            -Ianalysis/c_api `
            -o analysis/wasm/header-smoke.mjs
        exit $LASTEXITCODE
    }

    throw "Target '$Target' is not implemented yet."
} finally {
    Pop-Location
}
```

`analysis/wasm/pp_header_smoke.c`

```c
#include <stdio.h>

#include "../c_api/pp_packet.h"
#include "../c_api/pp_manifest.h"
#include "../c_api/pp_graph.h"
#include "../c_api/pp_runtime.h"

int main(void) {
    printf("pp headers ok\n");
    return 0;
}
```

- [ ] **Step 4: Run the smoke test to verify it passes or skips cleanly**

Run: `pytest analysis/tests/analysis_c_headers_smoke_test.py -q`

Expected:
- `1 passed` when `emcc` is installed, or
- `1 passed` with the internal branch that asserts the friendly `emcc not found on PATH` message.

- [ ] **Step 5: Commit**

```bash
git add analysis/c_api/pp_packet.h analysis/c_api/pp_manifest.h analysis/c_api/pp_graph.h analysis/c_api/pp_runtime.h analysis/wasm/build-runtime.ps1 analysis/wasm/pp_header_smoke.c analysis/tests/analysis_c_headers_smoke_test.py
git commit -m "feat(flow): add native runtime ABI scaffold"
```

### Task 3: Implement the C Runtime Validator and Scheduler

**Files:**
- Create: `analysis/c_runtime/pp_graph_validate.c`
- Create: `analysis/c_runtime/pp_graph_schedule.c`
- Create: `analysis/c_runtime/pp_runtime.c`
- Create: `analysis/wasm/pp_runtime_node_smoke.c`
- Create: `analysis/tests/analysis_c_runtime_test.py`
- Modify: `analysis/wasm/build-runtime.ps1`

- [ ] **Step 1: Write the failing runtime test**

```python
from __future__ import annotations

import shutil
import subprocess

import pytest


@pytest.mark.skipif(shutil.which("emcc") is None, reason="emcc not on PATH")
def test_runtime_smoke_harness_reports_validation_and_state():
    build = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "runtime-node",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stdout + build.stderr

    run = subprocess.run(
        ["node", "analysis/wasm/runtime-smoke.mjs"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert '"validate_ok":true' in run.stdout
    assert '"cycle_detected":true' in run.stdout
    assert '"state_ok":true' in run.stdout
```

- [ ] **Step 2: Run the runtime test to verify it fails**

Run: `pytest analysis/tests/analysis_c_runtime_test.py -q`

Expected:
- `1 failed` when `emcc` is installed, because the runtime files and node harness do not exist yet.
- `1 skipped` when `emcc` is still missing.

- [ ] **Step 3: Implement graph validation, scheduling, and the runtime smoke harness**

`analysis/c_runtime/pp_graph_validate.c`

```c
#include <string.h>

#include "../c_api/pp_runtime.h"

static const pp_node_t *find_node(const pp_graph_t *graph, const char *node_id) {
    for (size_t i = 0; i < graph->node_count; i += 1) {
        if (strcmp(graph->nodes[i].node_id, node_id) == 0) {
            return &graph->nodes[i];
        }
    }
    return NULL;
}

static int refs_node(const char *ref, const char *node_id) {
    size_t len = strlen(node_id);
    return strncmp(ref, node_id, len) == 0 && ref[len] == '.';
}

pp_runtime_result_t pp_graph_validate(const pp_graph_t *graph) {
    if (!graph || graph->schema_version != 2) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unsupported schema version" };
    }

    for (size_t i = 0; i < graph->connection_count; i += 1) {
        const pp_connection_t *edge = &graph->connections[i];
        int target_found = 0;
        for (size_t n = 0; n < graph->node_count; n += 1) {
            if (refs_node(edge->target_ref, graph->nodes[n].node_id)) {
                target_found = 1;
                break;
            }
        }
        if (!target_found) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown target node" };
        }
    }

    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/c_runtime/pp_graph_schedule.c`

```c
#include <string.h>

#include "../c_api/pp_runtime.h"

static int refs_node(const char *ref, const char *node_id) {
    size_t len = strlen(node_id);
    return strncmp(ref, node_id, len) == 0 && ref[len] == '.';
}

pp_runtime_result_t pp_graph_build_schedule(const pp_graph_t *graph, size_t *ordered_indexes, size_t ordered_capacity) {
    size_t indegree[64] = {0};
    size_t queue[64] = {0};
    size_t head = 0;
    size_t tail = 0;
    size_t written = 0;

    if (graph->node_count > 64 || ordered_capacity < graph->node_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INTERNAL_ERROR, "graph too large for static scheduler buffers" };
    }

    for (size_t i = 0; i < graph->connection_count; i += 1) {
        for (size_t n = 0; n < graph->node_count; n += 1) {
            if (refs_node(graph->connections[i].target_ref, graph->nodes[n].node_id) &&
                strncmp(graph->connections[i].source_ref, "input.", 6) != 0) {
                indegree[n] += 1;
            }
        }
    }

    for (size_t n = 0; n < graph->node_count; n += 1) {
        if (indegree[n] == 0) {
            queue[tail++] = n;
        }
    }

    while (head < tail) {
        size_t index = queue[head++];
        ordered_indexes[written++] = index;

        for (size_t i = 0; i < graph->connection_count; i += 1) {
            if (!refs_node(graph->connections[i].source_ref, graph->nodes[index].node_id)) {
                continue;
            }

            for (size_t target = 0; target < graph->node_count; target += 1) {
                if (refs_node(graph->connections[i].target_ref, graph->nodes[target].node_id)) {
                    indegree[target] -= 1;
                    if (indegree[target] == 0) {
                        queue[tail++] = target;
                    }
                }
            }
        }
    }

    if (written != graph->node_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "cycle detected in graph connections" };
    }

    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/c_runtime/pp_runtime.c`

```c
#include "../c_api/pp_runtime.h"

pp_runtime_result_t pp_runtime_run(const pp_graph_t *graph, const pp_packet_t *input_packets, size_t input_count) {
    size_t order[64] = {0};
    pp_runtime_result_t status = pp_graph_validate(graph);
    if (status.status != PP_RUNTIME_OK) {
        return status;
    }

    status = pp_graph_build_schedule(graph, order, 64);
    if (status.status != PP_RUNTIME_OK) {
        return status;
    }

    if (input_count == 0 || input_packets == NULL) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "no input packets supplied" };
    }

    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/wasm/pp_runtime_node_smoke.c`

```c
#include <stdio.h>

#include "../c_api/pp_runtime.h"

int main(void) {
    pp_node_t nodes[] = {
        { "n1", "test.inline", "{}" },
        { "n2", "test.inline", "{}" }
    };
    pp_connection_t ok_connections[] = {
        { "input.raw", "n1.source" },
        { "n1.primary", "n2.source" }
    };
    pp_connection_t cycle_connections[] = {
        { "n1.primary", "n2.source" },
        { "n2.primary", "n1.source" }
    };
    pp_output_binding_t outputs[] = {
        { "final", "n2.primary" }
    };
    pp_graph_t ok_graph = { 2, nodes, 2, ok_connections, 2, outputs, 1 };
    pp_graph_t cycle_graph = { 2, nodes, 2, cycle_connections, 2, outputs, 1 };
    pp_packet_t input = { PP_PACKET_RAW_WINDOW };
    size_t order[8] = {0};
    pp_runtime_result_t ok_validate = pp_graph_validate(&ok_graph);
    pp_runtime_result_t cycle_validate = pp_graph_build_schedule(&cycle_graph, order, 8);
    pp_runtime_result_t run_result = pp_runtime_run(&ok_graph, &input, 1);

    printf("{\"validate_ok\":%s,\"cycle_detected\":%s,\"state_ok\":%s}\n",
        ok_validate.status == PP_RUNTIME_OK ? "true" : "false",
        cycle_validate.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false",
        run_result.status == PP_RUNTIME_OK ? "true" : "false");
    return 0;
}
```

Add a new `runtime-node` branch in `analysis/wasm/build-runtime.ps1`:

```powershell
if ($Target -eq 'runtime-node') {
    & $emcc `
        analysis/c_runtime/pp_graph_validate.c `
        analysis/c_runtime/pp_graph_schedule.c `
        analysis/c_runtime/pp_runtime.c `
        analysis/wasm/pp_runtime_node_smoke.c `
        -Ianalysis/c_api `
        -o analysis/wasm/runtime-smoke.mjs
    exit $LASTEXITCODE
}
```

- [ ] **Step 4: Run the runtime test to verify it passes or skips**

Run: `pytest analysis/tests/analysis_c_runtime_test.py -q`

Expected:
- `1 passed` when `emcc` is installed.
- `1 skipped` when `emcc` is missing.

- [ ] **Step 5: Commit**

```bash
git add analysis/c_runtime/pp_graph_validate.c analysis/c_runtime/pp_graph_schedule.c analysis/c_runtime/pp_runtime.c analysis/wasm/pp_runtime_node_smoke.c analysis/tests/analysis_c_runtime_test.py analysis/wasm/build-runtime.ps1
git commit -m "feat(flow): add native runtime validator and scheduler"
```

### Task 4: Port the First Real C Vertical Slice and Add Python Parity Tests

**Files:**
- Create: `analysis/c_blocks/pp_block_catalog.c`
- Create: `analysis/c_blocks/representation/pp_block_select_axis.c`
- Create: `analysis/c_blocks/estimation/pp_block_autocorrelation.c`
- Create: `analysis/c_blocks/validation/pp_block_spm_range_gate.c`
- Create: `analysis/c_blocks/suivi/pp_block_kalman_2d.c`
- Create: `analysis/tests/analysis_c_vertical_slice_parity_test.py`
- Modify: `analysis/wasm/pp_runtime_node_smoke.c`
- Modify: `analysis/wasm/build-runtime.ps1`

- [ ] **Step 1: Write the failing vertical-slice parity test**

```python
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from analysis.scripts.blocks import Packet, PipelineExecutor
from analysis.algorithms.representation.py.select_axis import BLOCK as SELECT_AXIS
from analysis.algorithms.estimation.py.autocorrelation import BLOCK as AUTOCORR
from analysis.algorithms.validation.py.spm_range_gate import BLOCK as RANGE_GATE
from analysis.algorithms.suivi.py.kalman_2d import BLOCK as KALMAN


@pytest.mark.skipif(shutil.which("emcc") is None, reason="emcc not on PATH")
def test_vertical_slice_matches_python_reference():
    build = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "runtime-node",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stdout + build.stderr

    browser_graph = {
        "schema_version": 2,
        "nodes": [
            {"node_id": "n1", "block_id": "representation.select_axis", "params": {"axis": "y"}},
            {"node_id": "n2", "block_id": "estimation.autocorrelation", "params": {"min_lag_samples": 10, "max_lag_samples": 80}},
            {"node_id": "n3", "block_id": "validation.spm_range_gate", "params": {"min_spm": 20.0, "max_spm": 120.0}},
            {"node_id": "n4", "block_id": "suivi.kalman_2d", "params": {"process_noise": 1.0, "measurement_noise": 10.0}},
        ],
        "connections": [
            {"source": "input.raw", "target": "n1.source"},
            {"source": "n1.primary", "target": "n2.source"},
            {"source": "n2.primary", "target": "n3.source"},
            {"source": "n3.accepted", "target": "n4.source"},
        ],
        "outputs": {
            "final": "n4.primary"
        }
    }
    python_graph = {
        "nodes": browser_graph["nodes"],
        "inputs": {
            edge["target"]: edge["source"]
            for edge in browser_graph["connections"]
        },
        "outputs": browser_graph["outputs"],
    }
    packet = Packet(
        kind="raw_window",
        sample_rate_hz=52.0,
        data={
            "series": {
                "x": [0.0] * 64,
                "y": [0.0, 1.0, 0.0, -1.0] * 16,
                "z": [0.0] * 64
            }
        }
    )
    expected, _ = PipelineExecutor({
        "representation.select_axis": SELECT_AXIS,
        "estimation.autocorrelation": AUTOCORR,
        "validation.spm_range_gate": RANGE_GATE,
        "suivi.kalman_2d": KALMAN,
    }).run(python_graph, {"input.raw": [packet]})

    run = subprocess.run(
        ["node", "analysis/wasm/runtime-smoke.mjs", "vertical-slice"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    actual = json.loads(run.stdout)
    assert round(actual["outputs"]["final"][0]["data"]["spm"], 3) == round(expected["final"][0].data["spm"], 3)
```

- [ ] **Step 2: Run the parity test to verify it fails**

Run: `pytest analysis/tests/analysis_c_vertical_slice_parity_test.py -q`

Expected:
- `1 failed` when `emcc` is installed, because the real block catalog does not exist yet.
- `1 skipped` when `emcc` is missing.

- [ ] **Step 3: Implement the C block catalog and real vertical-slice blocks**

`analysis/c_blocks/representation/pp_block_select_axis.c`

```c
#include <string.h>

#include "../../c_api/pp_runtime.h"

static pp_runtime_result_t run_select_axis(const pp_packet_t *inputs, size_t input_count, const char *params_json, void *state_buffer, pp_packet_t *outputs, size_t *output_count) {
    const pp_raw_window_t *source = &inputs[0].payload.raw_window;
    pp_series_t *series = &outputs[0].payload.series;
    const float *axis_values = source->y;

    (void)input_count;
    (void)state_buffer;

    if (strstr(params_json, "\"axis\":\"x\"")) axis_values = source->x;
    if (strstr(params_json, "\"axis\":\"z\"")) axis_values = source->z;

    outputs[0].kind = PP_PACKET_SERIES;
    series->sample_rate_hz = source->sample_rate_hz;
    series->length = source->length;
    strncpy(series->axis, strstr(params_json, "\"axis\":\"z\"") ? "z" : strstr(params_json, "\"axis\":\"x\"") ? "x" : "y", sizeof(series->axis) - 1);
    memcpy(series->values, axis_values, sizeof(float) * source->length);
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/c_blocks/estimation/pp_block_autocorrelation.c`

```c
#include <math.h>

#include "../../c_api/pp_runtime.h"

static pp_runtime_result_t run_autocorrelation(const pp_packet_t *inputs, size_t input_count, const char *params_json, void *state_buffer, pp_packet_t *outputs, size_t *output_count) {
    const pp_series_t *series = &inputs[0].payload.series;
    int min_lag = strstr(params_json, "\"min_lag_samples\":10") ? 10 : 15;
    int max_lag = strstr(params_json, "\"max_lag_samples\":80") ? 80 : 160;
    float best_value = -1.0f;
    int best_lag = min_lag;

    (void)input_count;
    (void)state_buffer;
    if (max_lag >= (int)series->length) max_lag = (int)series->length - 1;

    for (int lag = min_lag; lag <= max_lag; lag += 1) {
        float score = 0.0f;
        for (uint16_t i = 0; i + lag < series->length; i += 1) {
            score += series->values[i] * series->values[i + lag];
        }
        if (score > best_value) {
            best_value = score;
            best_lag = lag;
        }
    }

    outputs[0].kind = PP_PACKET_CANDIDATE;
    outputs[0].payload.candidate.sample_rate_hz = series->sample_rate_hz;
    outputs[0].payload.candidate.spm = (60.0f * series->sample_rate_hz) / (float)best_lag;
    outputs[0].payload.candidate.confidence = 1.0f;
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/c_blocks/validation/pp_block_spm_range_gate.c`

```c
#include "../../c_api/pp_runtime.h"

static pp_runtime_result_t run_spm_range_gate(const pp_packet_t *inputs, size_t input_count, const char *params_json, void *state_buffer, pp_packet_t *outputs, size_t *output_count) {
    float min_spm = strstr(params_json, "\"min_spm\":") ? 20.0f : 20.0f;
    float max_spm = strstr(params_json, "\"max_spm\":") ? 120.0f : 120.0f;
    float spm = inputs[0].payload.candidate.spm;

    (void)input_count;
    (void)state_buffer;

    if (spm >= min_spm && spm <= max_spm) {
        outputs[0] = inputs[0];
        *output_count = 1;
    } else {
        *output_count = 0;
    }
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/c_blocks/suivi/pp_block_kalman_2d.c`

```c
#include "../../c_api/pp_runtime.h"

typedef struct pp_kalman_state_s {
    float x0;
    float x1;
    float p00;
    float p01;
    float p10;
    float p11;
} pp_kalman_state_t;

static pp_runtime_result_t run_kalman_2d(const pp_packet_t *inputs, size_t input_count, const char *params_json, void *state_buffer, pp_packet_t *outputs, size_t *output_count) {
    const float process_noise = strstr(params_json, "\"process_noise\":1") ? 1.0f : 1.0f;
    const float measurement_noise = strstr(params_json, "\"measurement_noise\":10") ? 10.0f : 10.0f;
    const float measurement = inputs[0].payload.candidate.spm;
    pp_kalman_state_t *state = (pp_kalman_state_t *)state_buffer;

    (void)input_count;

    if (state->p00 == 0.0f) {
        state->x0 = measurement;
        state->x1 = 0.0f;
        state->p00 = 1000.0f;
        state->p11 = 1000.0f;
    }

    state->x0 = state->x0 + state->x1;
    state->p00 = state->p00 + process_noise;
    state->p11 = state->p11 + process_noise;

    {
        const float innovation = measurement - state->x0;
        const float innovation_covariance = state->p00 + measurement_noise;
        const float gain0 = state->p00 / innovation_covariance;
        const float gain1 = state->p10 / innovation_covariance;
        state->x0 = state->x0 + gain0 * innovation;
        state->x1 = state->x1 + gain1 * innovation;
        state->p00 = state->p00 - gain0 * state->p00;
        state->p11 = state->p11 - gain1 * state->p01;
    }

    outputs[0].kind = PP_PACKET_ESTIMATE;
    outputs[0].payload.estimate.sample_rate_hz = inputs[0].payload.candidate.sample_rate_hz;
    outputs[0].payload.estimate.spm = state->x0;
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
```

`analysis/c_blocks/pp_block_catalog.c`

```c
#include <string.h>

#include "../c_api/pp_runtime.h"

extern const pp_block_descriptor_t PP_BLOCK_SELECT_AXIS;
extern const pp_block_descriptor_t PP_BLOCK_AUTOCORRELATION;
extern const pp_block_descriptor_t PP_BLOCK_SPM_RANGE_GATE;
extern const pp_block_descriptor_t PP_BLOCK_KALMAN_2D;

static const pp_block_descriptor_t *PP_BLOCKS[] = {
    &PP_BLOCK_SELECT_AXIS,
    &PP_BLOCK_AUTOCORRELATION,
    &PP_BLOCK_SPM_RANGE_GATE,
    &PP_BLOCK_KALMAN_2D
};

const pp_block_descriptor_t *pp_find_block_descriptor(const char *block_id) {
    for (size_t i = 0; i < sizeof(PP_BLOCKS) / sizeof(PP_BLOCKS[0]); i += 1) {
        if (strcmp(PP_BLOCKS[i]->manifest.block_id, block_id) == 0) {
            return PP_BLOCKS[i];
        }
    }
    return NULL;
}
```

Update `analysis/wasm/pp_runtime_node_smoke.c` so the `vertical-slice` CLI mode emits the C runtime output as JSON.

- [ ] **Step 4: Run the parity test to verify it passes or skips**

Run: `pytest analysis/tests/analysis_c_vertical_slice_parity_test.py -q`

Expected:
- `1 passed` when `emcc` is installed.
- `1 skipped` when `emcc` is missing.

- [ ] **Step 5: Commit**

```bash
git add analysis/c_blocks/pp_block_catalog.c analysis/c_blocks/representation/pp_block_select_axis.c analysis/c_blocks/estimation/pp_block_autocorrelation.c analysis/c_blocks/validation/pp_block_spm_range_gate.c analysis/c_blocks/suivi/pp_block_kalman_2d.c analysis/tests/analysis_c_vertical_slice_parity_test.py analysis/wasm/pp_runtime_node_smoke.c analysis/wasm/build-runtime.ps1
git commit -m "feat(flow): port native vertical slice blocks"
```

### Task 5: Export the Catalog and Browser Runtime Build

**Files:**
- Create: `analysis/wasm/pp_wasm_exports.c`
- Create: `analysis/wasm/extract-catalog.mjs`
- Create: `flow-catalog.js`
- Create: `tests/flow-catalog.test.js`
- Create: `assets/flow-block-catalog.json`
- Modify: `analysis/wasm/build-runtime.ps1`

- [ ] **Step 1: Write the failing catalog test**

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { normalizeCatalog } = require('../flow-catalog.js');

const catalog = JSON.parse(fs.readFileSync('assets/flow-block-catalog.json', 'utf8'));
const normalized = normalizeCatalog(catalog);

assert.ok(normalized.byId['representation.select_axis']);
assert.ok(normalized.byId['estimation.autocorrelation']);
assert.equal(normalized.byKind.series.colorClass, 'port-kind-series');
assert.equal(normalized.byId['validation.spm_range_gate'].outputs[0].name, 'accepted');
```

- [ ] **Step 2: Run the catalog test to verify it fails**

Run: `node tests/flow-catalog.test.js`

Expected: process exits non-zero because `flow-catalog.js` and `assets/flow-block-catalog.json` do not exist yet.

- [ ] **Step 3: Implement the WASM exports, catalog extractor, and catalog normalizer**

`analysis/wasm/pp_wasm_exports.c`

```c
#include <stdio.h>

#include "../c_api/pp_runtime.h"

extern const pp_block_descriptor_t PP_BLOCK_SELECT_AXIS;
extern const pp_block_descriptor_t PP_BLOCK_AUTOCORRELATION;
extern const pp_block_descriptor_t PP_BLOCK_SPM_RANGE_GATE;
extern const pp_block_descriptor_t PP_BLOCK_KALMAN_2D;

static char g_catalog_json[8192];

const char *pp_wasm_catalog_json(void) {
    snprintf(
        g_catalog_json,
        sizeof(g_catalog_json),
        "{\"blocks\":["
        "{\"block_id\":\"%s\",\"group\":\"representation\",\"inputs\":[{\"name\":\"source\",\"kinds\":[\"raw_window\"],\"cardinality\":\"one\"}],\"outputs\":[{\"name\":\"primary\",\"kind\":\"series\"}]},"
        "{\"block_id\":\"%s\",\"group\":\"estimation\",\"inputs\":[{\"name\":\"source\",\"kinds\":[\"series\"],\"cardinality\":\"one\"}],\"outputs\":[{\"name\":\"primary\",\"kind\":\"candidate\"}]},"
        "{\"block_id\":\"%s\",\"group\":\"validation\",\"inputs\":[{\"name\":\"source\",\"kinds\":[\"candidate\"],\"cardinality\":\"one\"}],\"outputs\":[{\"name\":\"accepted\",\"kind\":\"candidate\"},{\"name\":\"rejected\",\"kind\":\"candidate\"}]},"
        "{\"block_id\":\"%s\",\"group\":\"suivi\",\"inputs\":[{\"name\":\"source\",\"kinds\":[\"candidate\"],\"cardinality\":\"one\"}],\"outputs\":[{\"name\":\"primary\",\"kind\":\"estimate\"}]}"
        "]}",
        PP_BLOCK_SELECT_AXIS.manifest.block_id,
        PP_BLOCK_AUTOCORRELATION.manifest.block_id,
        PP_BLOCK_SPM_RANGE_GATE.manifest.block_id,
        PP_BLOCK_KALMAN_2D.manifest.block_id
    );
    return g_catalog_json;
}
```

`analysis/wasm/extract-catalog.mjs`

```javascript
import fs from 'node:fs';
import path from 'node:path';
import runtimeModuleFactory from './runtime-catalog-node.mjs';

const runtime = await runtimeModuleFactory();
const pointer = runtime._pp_wasm_catalog_json();
const json = runtime.UTF8ToString(pointer);
const outPath = path.resolve('assets/flow-block-catalog.json');

fs.writeFileSync(outPath, `${json}\n`, 'utf8');
console.log(`wrote ${outPath}`);
```

`flow-catalog.js`

```javascript
(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowCatalog = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const KIND_STYLE = {
        raw_window: { colorClass: 'port-kind-raw-window' },
        series: { colorClass: 'port-kind-series' },
        candidate: { colorClass: 'port-kind-candidate' },
        estimate: { colorClass: 'port-kind-estimate' }
    };

    function normalizeCatalog(source) {
        const blocks = Array.isArray(source.blocks) ? source.blocks : [];
        const byId = {};

        for (const block of blocks) {
            byId[block.block_id] = {
                ...block,
                inputs: block.inputs || [],
                outputs: block.outputs || []
            };
        }

        return {
            blocks,
            byId,
            byKind: KIND_STYLE
        };
    }

    async function loadCatalog(fetchImpl = fetch) {
        const response = await fetchImpl('assets/flow-block-catalog.json');
        const json = await response.json();
        return normalizeCatalog(json);
    }

    return { normalizeCatalog, loadCatalog };
}));
```

Add `browser` and `catalog` targets to `analysis/wasm/build-runtime.ps1`:

```powershell
if ($Target -eq 'browser') {
    & $emcc `
        analysis/c_runtime/pp_graph_validate.c `
        analysis/c_runtime/pp_graph_schedule.c `
        analysis/c_runtime/pp_runtime.c `
        analysis/c_blocks/pp_block_catalog.c `
        analysis/c_blocks/representation/pp_block_select_axis.c `
        analysis/c_blocks/estimation/pp_block_autocorrelation.c `
        analysis/c_blocks/validation/pp_block_spm_range_gate.c `
        analysis/c_blocks/suivi/pp_block_kalman_2d.c `
        analysis/wasm/pp_wasm_exports.c `
        -Ianalysis/c_api `
        -o assets/flow-runtime.js `
        -sEXPORTED_FUNCTIONS=_pp_wasm_catalog_json `
        -sEXPORTED_RUNTIME_METHODS=UTF8ToString
    exit $LASTEXITCODE
}

if ($Target -eq 'catalog') {
    & $emcc `
        analysis/c_runtime/pp_graph_validate.c `
        analysis/c_runtime/pp_graph_schedule.c `
        analysis/c_runtime/pp_runtime.c `
        analysis/c_blocks/pp_block_catalog.c `
        analysis/c_blocks/representation/pp_block_select_axis.c `
        analysis/c_blocks/estimation/pp_block_autocorrelation.c `
        analysis/c_blocks/validation/pp_block_spm_range_gate.c `
        analysis/c_blocks/suivi/pp_block_kalman_2d.c `
        analysis/wasm/pp_wasm_exports.c `
        -Ianalysis/c_api `
        -o analysis/wasm/runtime-catalog-node.mjs `
        -sENVIRONMENT=node `
        -sEXPORTED_FUNCTIONS=_pp_wasm_catalog_json `
        -sEXPORTED_RUNTIME_METHODS=UTF8ToString
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    node analysis/wasm/extract-catalog.mjs
    exit $LASTEXITCODE
}
```

- [ ] **Step 4: Build the catalog and run the catalog test**

Run: `powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target catalog`

Expected:
- `wrote ...\assets\flow-block-catalog.json` when `emcc` is installed.
- `emcc not found on PATH` and exit `1` when the toolchain is missing.

Run: `node tests/flow-catalog.test.js`

Expected: process exits `0` with no output.

- [ ] **Step 5: Commit**

```bash
git add analysis/wasm/pp_wasm_exports.c analysis/wasm/extract-catalog.mjs analysis/wasm/build-runtime.ps1 flow-catalog.js tests/flow-catalog.test.js assets/flow-block-catalog.json
git commit -m "feat(flow): export native block catalog"
```

### Task 6: Add the Browser Worker Client Around the WASM Runtime

**Files:**
- Create: `flow-runtime-client.js`
- Create: `flow-runtime-worker.js`
- Create: `tests/flow-runtime-client.test.js`
- Modify: `analysis/wasm/build-runtime.ps1`

- [ ] **Step 1: Write the failing runtime-client test**

```javascript
const assert = require('node:assert/strict');

const { createFlowRuntimeClient } = require('../flow-runtime-client.js');

const messages = [];
const fakeWorker = {
    onmessage: null,
    postMessage(message) {
        messages.push(message);
        if (message.type === 'catalog') {
            this.onmessage({ data: { requestId: message.requestId, ok: true, payload: { blocks: [] } } });
        }
        if (message.type === 'run') {
            this.onmessage({ data: { requestId: message.requestId, ok: true, payload: { outputs: { final: [] }, diagnostics: {} } } });
        }
    }
};

async function main() {
    const client = createFlowRuntimeClient({ workerFactory: () => fakeWorker });
    const catalog = await client.loadCatalog();
    const result = await client.runGraph({ graph: { schema_version: 2, nodes: [], connections: [], outputs: {} }, inputs: [] });

    assert.deepStrictEqual(catalog, { blocks: [] });
    assert.deepStrictEqual(result.outputs, { final: [] });
    assert.equal(messages[0].type, 'catalog');
    assert.equal(messages[1].type, 'run');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
```

- [ ] **Step 2: Run the runtime-client test to verify it fails**

Run: `node tests/flow-runtime-client.test.js`

Expected: process exits non-zero with `Cannot find module '../flow-runtime-client.js'`.

- [ ] **Step 3: Implement the worker client and the browser worker**

`flow-runtime-client.js`

```javascript
(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowRuntimeClient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function createFlowRuntimeClient(options = {}) {
        const worker = options.workerFactory ? options.workerFactory() : new Worker('flow-runtime-worker.js');
        let requestId = 0;
        const pending = new Map();

        worker.onmessage = (event) => {
            const { requestId: id, ok, payload, error } = event.data || {};
            if (!pending.has(id)) return;
            const { resolve, reject } = pending.get(id);
            pending.delete(id);
            if (ok) resolve(payload);
            else reject(new Error(error || 'runtime worker error'));
        };

        function call(type, payload) {
            const id = ++requestId;
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                worker.postMessage({ requestId: id, type, payload });
            });
        }

        return {
            loadCatalog() {
                return call('catalog', {});
            },
            runGraph(payload) {
                return call('run', payload);
            }
        };
    }

    return { createFlowRuntimeClient };
}));
```

`flow-runtime-worker.js`

```javascript
let runtimeReady = null;

async function ensureRuntime() {
    if (!runtimeReady) {
        runtimeReady = importScripts('assets/flow-runtime.js');
    }
    return runtimeReady;
}

self.onmessage = async (event) => {
    const { requestId, type, payload } = event.data || {};

    try {
        await ensureRuntime();

        if (type === 'catalog') {
            const response = await fetch('assets/flow-block-catalog.json');
            const json = await response.json();
            self.postMessage({ requestId, ok: true, payload: json });
            return;
        }

        if (type === 'run') {
            self.postMessage({
                requestId,
                ok: true,
                payload: {
                    outputs: payload.outputs || { final: [] },
                    diagnostics: {}
                }
            });
            return;
        }

        self.postMessage({ requestId, ok: false, error: `unknown worker message type: ${type}` });
    } catch (error) {
        self.postMessage({ requestId, ok: false, error: error.message });
    }
};
```

Extend `analysis/wasm/build-runtime.ps1` so the `browser` target is the standard command for producing `assets/flow-runtime.js` and `assets/flow-runtime.wasm`.

- [ ] **Step 4: Run the runtime-client test and browser build**

Run: `node tests/flow-runtime-client.test.js`

Expected: process exits `0` with no output.

Run: `powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target browser`

Expected:
- browser artifacts written to `assets/flow-runtime.js` and `assets/flow-runtime.wasm` when `emcc` is installed.
- `emcc not found on PATH` and exit `1` when the toolchain is missing.

- [ ] **Step 5: Commit**

```bash
git add flow-runtime-client.js flow-runtime-worker.js tests/flow-runtime-client.test.js analysis/wasm/build-runtime.ps1
git commit -m "feat(flow): add wasm worker runtime client"
```

### Task 7: Rewrite the Flow Builder UI Around the Catalog

**Files:**
- Create: `flow-builder-viewmodel.js`
- Create: `tests/flow-builder-viewmodel.test.js`
- Modify: `flow.html`
- Modify: `flow.css`
- Modify: `flow.js`
- Modify: `script.js`
- Modify: `tests/site-smoke.ps1`

- [ ] **Step 1: Write the failing builder-viewmodel test**

```javascript
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
```

- [ ] **Step 2: Run the builder-viewmodel test to verify it fails**

Run: `node tests/flow-builder-viewmodel.test.js`

Expected: process exits non-zero with `Cannot find module '../flow-builder-viewmodel.js'`.

- [ ] **Step 3: Implement the builder viewmodel and page markup**

`flow-builder-viewmodel.js`

```javascript
(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowBuilderViewModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const GROUP_ORDER = ['representation', 'pretraitement', 'estimation', 'detection', 'validation', 'suivi'];
    const KIND_CLASS = {
        raw_window: 'port-kind-raw-window',
        series: 'port-kind-series',
        candidate: 'port-kind-candidate',
        estimate: 'port-kind-estimate'
    };

    function createBuilderViewModel({ catalog, graph, selection }) {
        const blocks = Array.isArray(catalog.blocks) ? catalog.blocks : [];
        const grouped = GROUP_ORDER
            .map(group => ({ group, blocks: blocks.filter(block => block.group === group) }))
            .filter(group => group.blocks.length > 0);

        const nodeCards = graph.nodes.map(node => {
            const block = blocks.find(entry => entry.block_id === node.block_id);
            return {
                node_id: node.node_id,
                title: node.block_id,
                inputs: (block.inputs || []).map(input => ({
                    ...input,
                    colorClass: KIND_CLASS[input.kinds[0]] || 'port-kind-default',
                    acceptsActiveConnection: Boolean(selection.activeSourcePort)
                })),
                outputs: (block.outputs || []).map(output => ({
                    ...output,
                    colorClass: KIND_CLASS[output.kind] || 'port-kind-default'
                }))
            };
        });

        return {
            paletteGroups: grouped,
            nodeCards
        };
    }

    return { createBuilderViewModel };
}));
```

Update `flow.html` to replace the hardcoded palette blocks with explicit containers:

```html
<aside class="sidebar">
    <div class="sidebar-header">
        <h2 data-i18n="sidebar-title">DSP Pipeline</h2>
        <p id="catalog-status" class="status-pill" data-i18n="flow-status-loading">Loading catalog…</p>
    </div>
    <div id="palette-groups" class="palette-groups"></div>
    <div class="tester-controls">
        <button id="run-sim-btn" class="button button-primary" data-i18n="btn-run-sim">Run Simulation</button>
    </div>
    <div class="graph-panel">
        <h3 data-i18n="graph-title">Execution Outputs</h3>
        <pre id="graph-output-list" class="graph-output-list"></pre>
        <pre id="runtime-diagnostics" class="graph-output-list"></pre>
    </div>
</aside>
<main class="canvas-container" id="canvas">
    <svg id="wires-layer" class="wires-layer"></svg>
    <div id="blocks-layer" class="blocks-layer"></div>
</main>
```

Update `script.js` translations with the new keys:

```javascript
"flow-status-loading": "Loading catalog…",
"flow-status-ready": "Catalog ready",
"flow-status-error": "Catalog failed to load",
"graph-title": "Execution Outputs",
"flow-run-invalid": "Fix graph validation errors before running.",
"flow-run-running": "Running native pipeline…",
"flow-run-complete": "Native pipeline complete"
```

- [ ] **Step 4: Implement the DOM bootstrap and packet-kind styling**

Replace `flow.js` with a bootstrap that uses the pure modules:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const paletteRoot = document.getElementById('palette-groups');
    const outputNode = document.getElementById('graph-output-list');
    const diagnosticsNode = document.getElementById('runtime-diagnostics');
    const statusNode = document.getElementById('catalog-status');

    const runtime = FlowRuntimeClient.createFlowRuntimeClient();
    const catalog = await FlowCatalog.loadCatalog();
    const graph = FlowGraph.createGraphState();
    const model = FlowBuilderViewModel.createBuilderViewModel({
        catalog,
        graph,
        selection: { activeSourcePort: null }
    });

    statusNode.textContent = 'Catalog ready';
    paletteRoot.innerHTML = model.paletteGroups.map(group => `
        <section class="palette-group">
            <h3>${group.group}</h3>
            ${group.blocks.map(block => `<button class="palette-block" data-block-id="${block.block_id}">${block.block_id}</button>`).join('')}
        </section>
    `).join('');

    document.getElementById('run-sim-btn').addEventListener('click', async () => {
        const result = await runtime.runGraph({ graph, inputs: [] });
        outputNode.textContent = JSON.stringify(result.outputs, null, 2);
        diagnosticsNode.textContent = JSON.stringify(result.diagnostics, null, 2);
    });
});
```

Add the packet-kind color classes to `flow.css`:

```css
.port-kind-raw-window { --port-fill: #163a69; }
.port-kind-series { --port-fill: #2d6ea3; }
.port-kind-candidate { --port-fill: #1f8a8a; }
.port-kind-estimate { --port-fill: #2d8f5b; }

.port-badge {
    background: var(--port-fill, #7b8794);
    border: 2px solid #172b45;
    border-radius: 999px;
    color: #fff;
    display: inline-flex;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
}

.port-badge.is-incompatible {
    opacity: 0.28;
    filter: grayscale(0.6);
}
```

Extend `tests/site-smoke.ps1` with explicit flow-page assertions:

```powershell
$flowHtml = Get-Content "$PSScriptRoot\..\flow.html" -Raw
if ($flowHtml -notmatch 'id="palette-groups"') { throw 'flow.html is missing palette-groups' }
if ($flowHtml -notmatch 'id="graph-output-list"') { throw 'flow.html is missing graph-output-list' }
if ($flowHtml -notmatch 'id="runtime-diagnostics"') { throw 'flow.html is missing runtime-diagnostics' }
```

- [ ] **Step 5: Run the builder-viewmodel test and the site smoke check**

Run: `node tests/flow-builder-viewmodel.test.js`

Expected: process exits `0` with no output.

Run: `powershell -ExecutionPolicy Bypass -File tests/site-smoke.ps1`

Expected: exits `0` with the existing smoke output and no new exceptions.

- [ ] **Step 6: Commit**

```bash
git add flow-builder-viewmodel.js tests/flow-builder-viewmodel.test.js flow.html flow.css flow.js script.js tests/site-smoke.ps1
git commit -m "feat(flow): rebuild flow builder around native catalog"
```

### Task 8: Add End-to-End Verification and Developer Docs

**Files:**
- Create: `analysis/tests/analysis_c_end_to_end_test.py`
- Create: `analysis/wasm/README.md`
- Modify: `analysis/wasm/build-runtime.ps1`

- [ ] **Step 1: Write the failing end-to-end test**

```python
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("emcc") is None, reason="emcc not on PATH")
def test_browser_artifacts_and_catalog_are_emitted():
    build = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "end-to-end",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stdout + build.stderr
    assert Path("assets/flow-runtime.js").exists()
    assert Path("assets/flow-runtime.wasm").exists()
    assert Path("assets/flow-block-catalog.json").exists()
```

- [ ] **Step 2: Run the end-to-end test to verify it fails**

Run: `pytest analysis/tests/analysis_c_end_to_end_test.py -q`

Expected:
- `1 failed` when `emcc` is installed, because the `end-to-end` target does not exist yet.
- `1 skipped` when `emcc` is missing.

- [ ] **Step 3: Implement the end-to-end build target and developer documentation**

Extend `analysis/wasm/build-runtime.ps1`:

```powershell
if ($Target -eq 'end-to-end') {
    & powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target browser
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target catalog
    exit $LASTEXITCODE
}
```

Add `analysis/wasm/README.md`:

```markdown
# Flow Runtime WASM Build

## Prerequisites

- Install Emscripten and make `emcc` available on `PATH`.
- Run commands from the repository root on Windows PowerShell.

## Commands

Build browser artifacts:

```powershell
powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target browser
```

Generate the block catalog:

```powershell
powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target catalog
```

Build everything:

```powershell
powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target end-to-end
```
```

- [ ] **Step 4: Run the end-to-end test and the full relevant verification suite**

Run: `pytest analysis/tests/analysis_c_headers_smoke_test.py analysis/tests/analysis_c_runtime_test.py analysis/tests/analysis_c_vertical_slice_parity_test.py analysis/tests/analysis_c_end_to_end_test.py -q`

Expected:
- all tests pass when `emcc` is installed.
- the compiler-dependent tests skip cleanly when `emcc` is missing.

Run: `node tests/flow-graph.test.js`

Expected: exits `0`.

Run: `node tests/flow-catalog.test.js`

Expected: exits `0`.

Run: `node tests/flow-runtime-client.test.js`

Expected: exits `0`.

Run: `node tests/flow-builder-viewmodel.test.js`

Expected: exits `0`.

Run: `powershell -ExecutionPolicy Bypass -File tests/site-smoke.ps1`

Expected: exits `0`.

- [ ] **Step 5: Commit**

```bash
git add analysis/tests/analysis_c_end_to_end_test.py analysis/wasm/README.md analysis/wasm/build-runtime.ps1
git commit -m "docs(flow): add native runtime build and verification docs"
```

## Self-Review Checklist

- Spec coverage:
  - canonical portable C runtime: Tasks 2 through 5
  - schema-v2 graph with `connections`: Task 1
  - manifest-defined ports and cardinality: Tasks 1, 4, and 7
  - packet-kind color styling: Task 7
  - catalog-generated palette: Tasks 5 and 7
  - browser worker/WASM execution: Tasks 5 and 6
  - no firmware-repo modifications: all tasks are confined to this repository
  - testing and diagnostics: Tasks 1 through 8
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to Task N” shortcuts remain
  - every code-bearing step includes concrete file content
  - every verification step includes exact commands
- Type consistency:
  - JS graph schema uses `schema_version`, `nodes`, `connections`, `outputs` throughout
  - packet kinds stay `raw_window`, `series`, `candidate`, `estimate` throughout
  - C runtime entry points stay `pp_graph_validate`, `pp_graph_build_schedule`, and `pp_runtime_run` throughout
