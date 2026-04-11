# Flow Builder Preview Replay Design

**Date:** 2026-04-11
**Status:** Draft

## Problem

The browser preview can now validate and execute explicit source and representation graphs, but it still has no real source data. Source blocks run through hardware stubs, which means:

- `source.*` emits empty packets
- estimators and detectors fail at execution time
- `Execution Outputs` cannot answer the main product question: what cadence estimate does this graph produce over a real session?

The repository already contains a suitable Polar replay log at:

- `flow-builder/logs/raw_logs/polar_log_002.csv`

That log should be used as the first default preview dataset.

## Goals

1. Load `flow-builder/logs/raw_logs/polar_log_002.csv` automatically for browser preview.
2. Treat one press of `Run Simulation` as a full replay over every CSV row.
3. Convert each CSV row into one `raw_window` runtime packet with `sample_rate_hz = 52`.
4. Execute the current graph once per replay row and collect the final cadence output over time.
5. Render that cadence-over-time series inside `Execution Outputs`.
6. Keep the existing JSON diagnostics available for debugging failed runs.

## Non-Goals

- Do not add manual file import in this phase.
- Do not add per-node charts or intermediate-signal plotting.
- Do not redesign the canvas or block editor.
- Do not change firmware code or the WASM bridge packet ABI.
- Do not flatten the CSV into one continuous stream.

## Dataset Contract

The first-pass replay source is the checked-in file:

- `flow-builder/logs/raw_logs/polar_log_002.csv`

The parser must support the packed-window layout already present in that file:

- `timestamp`
- `count`
- `x_000` through `x_511`
- `y_000` through `y_511`
- `z_000` through `z_511`

For each row:

- `timestamp` is the chart X-axis value
- `count` is the number of valid samples in the row
- only the first `count` values from each axis group are used
- trailing unused cells are ignored

Each parsed row becomes one preview replay step, not one fragment of a larger stream.

## Runtime Data Flow

### Preview Graph Adaptation

The editor graph stays source-oriented for users, for example:

- `source.polar -> representation.select_axis -> ...`

The replay runner cannot feed CSV data directly into `source.polar`, because the WASM JSON execution contract accepts runtime packets through system inputs such as `input.raw`.

For preview replay only, the page should derive a temporary execution graph before running:

1. find the replay-backed raw-window source node
2. remove that source node from the execution graph
3. replace each outgoing edge from that source node with an edge from `input.raw`
4. keep the rest of the graph and output bindings unchanged

This normalization is preview-only:

- it is not persisted back into the saved graph
- it does not change upload compilation
- it does not change what the user sees on the canvas

For the first pass, preview replay only supports one replay-backed raw-window source node. The expected case is `source.polar`.

If the graph has:

- no replay-backed source node
- more than one replay-backed source node
- a replay-backed source node with unsupported topology

then `Run Simulation` should fail with a clear replay-configuration message instead of a generic runtime error

### Page Load

On page initialization, the browser should fetch and parse `flow-builder/logs/raw_logs/polar_log_002.csv` once and cache the resulting replay frames in memory.

If the replay file cannot be loaded or parsed:

- the page remains usable
- `Run Simulation` is disabled or fails with a clear replay-data status message
- diagnostics explain whether the failure was fetch-related or parse-related

### Run Simulation

One click on `Run Simulation` should:

1. validate that replay frames are available
2. derive the temporary replay execution graph
3. iterate over every parsed CSV row in order
4. build one runtime input packet for that row:
   - `binding_name = raw`
   - `kind = raw_window`
   - `sample_rate_hz = 52`
   - `length = count`
   - `x`, `y`, `z` arrays sliced to `count`
5. execute the replay execution graph once for that packet
6. read the final bound output after each run
7. extract the cadence value when the final output is an `estimate` packet
8. append one chart point `{ timestamp, cadence }`

If an individual replay step fails, the run stops and the UI surfaces:

- the replay row index
- the timestamp for the failed row when available
- the runtime error message

The diagnostics pane should still show the last runtime result that was produced.

## Output Model

The replay run should produce one high-level result object in the page state:

- `series`: ordered cadence-over-time points
- `lastStepResult`: the final successful runtime payload
- `replayMeta`: frame count, source path, sample rate, and any failure metadata

This keeps chart rendering separate from the low-level runtime payload while preserving the existing debugging surface.

## Execution Outputs UI

`Execution Outputs` should become a combined results area:

1. a cadence-over-time chart
2. the final step outputs JSON
3. the final step diagnostics JSON

The chart should live in the existing execution outputs region rather than in a new panel.

### First-Pass Chart Requirements

The chart only needs to answer one question:

- what cadence estimate does this graph produce over the replay log?

For the first pass, the chart can be a simple inline SVG or canvas line chart with:

- time on the X axis
- cadence on the Y axis
- one connected line
- a compact empty state when no cadence samples were produced

It does not need zooming, tooltips, brushing, legends, or multi-series overlays.

## Error Handling

Replay-specific failures should be explicit instead of collapsing into generic runtime errors.

Expected cases:

- replay CSV fetch failed
- replay CSV parse failed
- replay CSV contained no valid rows
- graph execution failed on replay row `N`
- final output was missing or was not an `estimate`

These errors should be shown in the execution outputs diagnostics area and, where appropriate, the existing status text.

## Testing Strategy

Add regression coverage for:

- CSV parsing from `flow-builder/logs/raw_logs/polar_log_002.csv`
- respecting `count` when extracting `x`, `y`, and `z`
- preview graph normalization from `source.polar` to `input.raw`
- replay packet construction with `sample_rate_hz = 52`
- replay execution calling the runtime once per parsed row
- cadence-series extraction from final `estimate` outputs
- UI rendering of a non-empty chart series in `Execution Outputs`
- clear failure handling when replay data is unavailable or malformed

The tests should avoid depending on real browser rendering beyond what is required to prove that the chart container and replay-derived state are populated.

## Success Criteria

- Loading the page makes the default replay dataset available without manual import.
- One press of `Run Simulation` replays the full CSV in one run.
- A valid Polar default pipeline produces a cadence-over-time chart in `Execution Outputs`.
- The page still exposes final-step outputs and diagnostics for debugging.
- Replay-data failures are distinguishable from graph-validation failures and block-execution failures.
