# Flow Builder Native Runtime Design

Date: 2026-04-08

## Goal

Replace the current prototype flow builder with a manifest-driven graph editor that executes real DSP blocks in the browser from a portable C runtime compiled to WebAssembly.

The same C block implementations must be designed so they can be adopted later by the firmware project at `C:\dev\_work\PaddlingPulse\firmware`, but this phase modifies only the current repository.

## Why This Direction

The current builder in [flow.js](C:\work\PaddlePulse\eddydq.github.io\flow.js) is a UI prototype with hardcoded block types and arbitrary sockets. The `analysis` system is closer to the desired model because it already has:

- block manifests
- typed packets
- named outputs
- graph execution
- stateful blocks

However, GitHub Pages cannot run the existing Python runtime directly, and the longer-term target is an embedded DSP pipeline on the DA14531. Because of that, the canonical runtime should move toward portable C, not JavaScript or Python.

## Non-Goals

- Do not modify `C:\dev\_work\PaddlingPulse\firmware` in this phase.
- Do not allow users to add arbitrary unnamed input or output sockets. Ports and their allowed multiplicity must be defined by each block manifest.
- Do not introduce a backend service.
- Do not make Python the long-term execution source of truth.

## Canonical Runtime

The new source of truth is a portable C block runtime in this repository.

That runtime will be compiled into:

- WebAssembly for `flow.html` on GitHub Pages
- a future firmware-consumable C library, without changing the firmware repo yet

Python in `analysis` remains temporarily useful as:

- a reference implementation for behavior checks
- a regression oracle during the C port
- an optional offline harness while the C catalog is incomplete

The existing CLI-style C stubs under `analysis/algorithms/*/c` are not the target design. The new runtime must not depend on `stdin/stdout` protocols or host-specific process execution.

## Runtime Architecture

### Core Principle

Each DSP block is implemented once in portable C and wrapped by thin platform-specific adapters.

### Layers

1. Core block layer

- pure portable C
- no filesystem
- no `stdin/stdout`
- no browser APIs
- no DA14531 SDK dependencies
- no dynamic allocation requirement

2. Runtime layer

- graph validation
- topological scheduling
- packet routing
- state ownership
- diagnostics collection

3. Adapter layer

- WebAssembly adapter for the browser
- optional test adapter for local validation
- future firmware adapter for `C:\dev\_work\PaddlingPulse\firmware`

## Block ABI

Each block must expose a stable C-facing contract that the browser runtime and future firmware integration can both consume.

### Required Metadata

- `block_id`
- `group`
- `input_ports`
- `output_ports`
- `params_schema`
- `stateful`

### Required Functions

- `init` or `reset`
- `run`
- optional manifest accessor if metadata is not emitted statically

### ABI Constraints

- fixed structs
- explicit packet kinds
- explicit named ports
- caller-owned input and output buffers
- deterministic memory usage
- no hidden heap ownership

This is required so the same implementation is safe for both a browser-hosted WASM build and a constrained embedded target later.

## Packet Model

The runtime continues to use typed packets as the unit of block communication.

Representative packet kinds from the current system are:

- `raw_window`
- `series`
- `candidate`
- `estimate`

Each packet struct should retain the semantic fields already present in the Python contract where relevant, such as:

- sample rate
- axis
- confidence
- timestamps or window identity
- metadata for diagnostics where justified

The exact C representation can be simplified where needed for determinism, but the semantic contract should remain aligned with the existing `analysis` behavior.

## Graph Contract

The current `analysis` graph shape is close but not sufficient for a serious builder because it models inputs as a one-to-one map. Blocks such as `validation.consensus_band` and `validation.fallback_selector` imply real fan-in, so the graph contract must be upgraded.

### New Graph Shape

```json
{
  "schema_version": 2,
  "nodes": [
    {
      "node_id": "n1",
      "block_id": "representation.select_axis",
      "params": { "axis": "y" }
    }
  ],
  "connections": [
    { "source": "input.raw", "target": "n1.source" }
  ],
  "outputs": {
    "accepted": "n1.primary"
  }
}
```

### Why `connections` Replaces Flat `inputs`

- it matches what the UI actually edits
- it supports multi-source fan-in
- it supports future graph tooling more cleanly
- it simplifies routing in the C runtime

### Port Rules

Input ports must become explicit manifest objects rather than an implicit `"source"` convention plus `input_kinds`.

Each input port definition should include:

- port name
- accepted packet kinds
- cardinality: `one` or `many`

Each output port definition should include:

- port name
- emitted packet kind

## Builder Behavior

The new flow builder becomes a manifest-driven editor, not a freeform widget sandbox.

### Palette

The palette is generated from the canonical block catalog and grouped by:

- `representation`
- `pretraitement`
- `estimation`
- `detection`
- `validation`
- `suivi`

### Node Creation

Dropping a block onto the canvas creates a node with:

- a generated `node_id`
- a fixed set of named input ports from the manifest
- a fixed set of named output ports from the manifest
- generated parameter controls from `params_schema`

The builder must not allow arbitrary `+/-` input or output sockets. Port count, names, and whether an input accepts one or many connections must come from the block manifest.

### Connections

The builder only allows valid edges.

Validation rules:

- source output kind must match the target input port accepted kinds
- single-cardinality input ports accept at most one incoming edge
- multi-cardinality input ports may accept many incoming edges
- cycles are rejected
- unknown block or port identifiers are rejected

### Port Styling

The builder may use color as a visual aid for compatibility, but color must not replace the manifest contract.

Recommended behavior:

- assign a consistent color family to each packet kind
- render compatible ports with the same color family
- mute or disable incompatible targets during connection drag
- use labels, tooltips, or icons in addition to color so compatibility is not conveyed by color alone

If an input port accepts multiple packet kinds, the UI may use a mixed or segmented visual treatment, but the actual compatibility rule remains packet-kind validation from the manifest.

### Boundary Nodes

The builder must expose graph boundaries cleanly.

Required boundary concepts:

- a system input such as `input.raw`
- user-selectable exported outputs

These can be shown as pinned system nodes or equivalent explicit UI elements, but the saved graph contract must remain unambiguous.

### Run Behavior

Running a pipeline in the browser must:

1. validate the graph
2. build a scheduled execution order
3. invoke the WASM runtime
4. collect outputs and diagnostics
5. render named outputs separately

The result view must understand that a node may emit multiple named outputs such as `accepted` and `rejected`.

## Repository Layout

All new canonical runtime work stays in this repository for now.

Proposed layout:

- `analysis/c_api/`
  - shared C headers for packets, manifests, params, graph structs, runtime ABI
- `analysis/c_blocks/<group>/`
  - canonical portable block implementations
- `analysis/c_runtime/`
  - graph executor, validation, routing, diagnostics
- `analysis/wasm/`
  - WebAssembly adapter and build scripts
- `assets/`
  - emitted browser artifacts such as `flow-runtime.wasm` and generated catalog JSON

Python remains in place during migration and is not the canonical runtime.

## Relationship To Existing Firmware Code

The design must stay compatible with future firmware adoption, but this phase does not touch the firmware repository.

The existing firmware implementation in [paddling_pulse_stroke_rate.c](C:\dev\_work\PaddlingPulse\firmware\app\src\paddling_pulse_stroke_rate.c) is the model for the desired style:

- numeric core separated from platform integration
- explicit tuning constants
- deterministic runtime behavior
- embedded-safe data ownership

The new portable C runtime should be written so that a later firmware integration can adopt it with thin glue rather than a rewrite.

## Migration Strategy

### Phase 1: Define the C Contract

- create the shared packet, manifest, param, and runtime ABI
- define the schema versioned graph format
- define catalog emission for the browser

### Phase 2: Build the Runtime

- implement graph validation
- implement topological scheduling
- implement packet routing
- implement state persistence between runs
- implement diagnostics

### Phase 3: Port an End-to-End Vertical Slice

Start with the core pipeline closest to the existing firmware behavior:

- `representation.select_axis`
- autocorrelation-related estimation and guard stages
- Kalman-related tracking stages

This proves the contract, builder, runtime, and WASM bridge with a real pipeline before porting the full catalog.

### Phase 4: Builder Conversion

- remove hardcoded palette block definitions from the current builder
- generate the palette from the catalog
- replace arbitrary sockets with manifest-defined ports
- save and load the schema-versioned graph format
- wire run execution to WASM

### Phase 5: Regression Harness

Add tests that compare Python and C outputs on shared fixtures wherever parity is expected.

This harness should focus on:

- representative windows for each packet kind
- parameter edge cases
- stateful block sequences
- graph execution behavior

### Phase 6: Complete Catalog Port

Port the remaining blocks group by group until the browser runtime covers the full `analysis` catalog targeted for the demo.

## Error Handling

The system should fail explicitly rather than trying to guess.

### Builder Errors

- invalid wire type match
- missing required input
- duplicate single-cardinality input connection
- cycle detected
- invalid parameter value

### Runtime Errors

- unknown block id
- unknown port id
- packet kind mismatch
- output buffer overflow
- malformed graph
- unsupported schema version

### User-Facing Policy

- validation failures block execution and point to the exact node or edge
- runtime failures surface a concise message plus structured diagnostics for debugging

## Testing Strategy

### Contract Tests

- manifest validity
- packet kind enforcement
- graph validation behavior
- stateful behavior across repeated runs

### Block Tests

- per-block deterministic fixtures for C implementations
- parity tests against Python reference behavior where applicable

### Runtime Tests

- routing between named ports
- fan-in behavior
- multi-output behavior
- topological scheduling
- schema compatibility

### Browser Tests

- catalog-driven palette rendering
- parameter form generation
- connection validity enforcement
- graph serialization and deserialization
- WASM execution integration

## Open Decisions Intentionally Deferred

These decisions should be made during implementation planning, not in this design document:

- exact C header naming conventions
- precise WASM toolchain wrapper scripts
- whether catalog generation happens at build time or from checked-in generated artifacts
- exact visual treatment of system input and output nodes

## Recommendation

Proceed with a C-first native runtime inside this repository, use it as the sole execution engine for the GitHub Pages builder through WebAssembly, and treat the current Python `analysis` implementation as a migration aid rather than the final runtime.

This aligns the web demo with the eventual embedded deployment path and avoids maintaining separate algorithm implementations for browser and firmware targets.
