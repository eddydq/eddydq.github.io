# Flow Builder Firmware Parity Design

**Date:** 2026-04-09
**Status:** Draft

## Problem

The flow builder currently mixes three different contracts for the same pipeline:

1. The real DA14531 firmware build in `C:\dev\_work\PaddlingPulse\firmware`
2. The vendored firmware snapshot under `flow-builder/wasm/firmware/`
3. Browser-facing metadata and normalization logic in the flow builder UI, compiler, and WASM bridge

Those contracts are close, but not identical. The result is parameter drift:

- the firmware fallback pipeline is explicit and sample-rate-driven
- the browser compiler hides source-axis handling by injecting representation nodes
- the generated catalog says source blocks output `series`, while the firmware manifests say source blocks output `raw_window`
- the WASM bridge still exposes `source.polar` with `axis_mask`, while the compiler and checked-in catalog treat Polar as `sample_rate_hz = 52`

That drift makes it impossible to trust that a graph assembled in the browser is the same graph the firmware actually runs.

## Verified Firmware Target

This design targets the current firmware build configuration in `C:\dev\_work\PaddlingPulse\firmware`:

- IMU source: `CFG_IMU_POLAR`
- axis: `CFG_IMU_AXIS_Z`
- sample rate: `52 Hz`

The default firmware graph built in `firmware/app/src/paddling_pulse_app.c` is:

1. `source.polar`
2. `representation.select_axis`
3. `pretraitement.hpf_gravity`
4. `estimation.autocorrelation`
5. `suivi.kalman_2d`

With effective parameters:

- `source.polar.sample_rate_hz = 52`
- `representation.select_axis.axis = z`
- `pretraitement.hpf_gravity.cutoff_hz = 1`
- `pretraitement.hpf_gravity.order = 2`
- `estimation.autocorrelation.min_lag = 15`
- `estimation.autocorrelation.max_lag = 104`
- `estimation.autocorrelation.confidence_min = 0`
- `estimation.autocorrelation.harmonic_pct = 80`
- `suivi.kalman_2d.q = 256`
- `suivi.kalman_2d.r = 256`
- `suivi.kalman_2d.p_max = 10000`
- `suivi.kalman_2d.max_jump = 20`

The lag values are derived from the firmware constants:

- `min_lag = floor((60 * 52) / 200) = 15`
- `max_lag = floor((60 * 52) / 30) = 104`

## Goals

1. Make the browser graph model match the real firmware pipeline structure exactly.
2. Fix Polar sampling to the firmware-supported `52 Hz` value in every browser-facing contract.
3. Remove contract drift between catalog generation, preview execution, graph compilation, and BLE upload.
4. Keep the browser within the OTA protocol limits already defined by the firmware and the OTA pipeline service plan.
5. Make the firmware-default pipeline available as an explicit preset so users start from the real embedded behavior.
6. Add replayable sample data so preview can render a final cadence estimate chart for the firmware-default pipeline.

## Non-Goals

- Do not change `C:\dev\_work\PaddlingPulse\firmware` in this phase.
- Do not add new DSP blocks.
- Do not redesign the visual editor layout.
- Do not expand OTA protocol limits beyond the current firmware caps.
- Do not preserve older hidden-axis source behavior as a first-class editing model.
- Do not add per-stage oscilloscope-style plotting in this phase.

## OTA and Firmware Limits

The flow builder must keep enforcing the current embedded limits:

- max nodes: `16`
- max edges: `20`
- max pipeline binary size: `512 bytes`
- protocol version: `1`
- header + TLV binary format remains unchanged

These limits are already reflected in the firmware snapshot and the OTA pipeline service plan and must remain hard validation errors in the browser.

## Source Of Truth

### Authoritative behavior

The external firmware repo at `C:\dev\_work\PaddlingPulse\firmware` is the authoritative source for the target pipeline behavior and current build-time configuration.

### Browser execution input

The vendored snapshot under `flow-builder/wasm/firmware/` is the source of truth for browser preview and catalog generation inside this repository.

### Required discipline

The flow builder must stop inventing an alternate browser-only block contract. Instead:

- firmware manifests and block execution semantics define packet kinds and parameter encoding
- browser metadata only adds presentation details such as display names and enum labels
- the checked-in JSON catalog is generated from the vendored firmware snapshot, not hand-maintained separately

## Target Graph Model

The editor must represent the literal firmware graph, not a normalized convenience graph.

### Source blocks

Source blocks must expose their real firmware behavior:

- outputs emit `raw_window`
- they do not implicitly select an axis
- they do not implicitly collapse to `series`

### Representation blocks

Axis selection must be explicit:

- `representation.select_axis` converts `raw_window -> series`
- `representation.vector_magnitude` converts `raw_window -> series`

That means a firmware-faithful Polar pipeline is shown as:

`source.polar -> representation.select_axis -> pretraitement.hpf_gravity -> estimation.autocorrelation -> suivi.kalman_2d`

not as a single source block with hidden axis logic.

## Parameter Contract

### Polar source

`source.polar` must expose `sample_rate_hz` as a fixed, non-editable parameter with the value `52`.

The browser must not expose `axis_mask` for Polar in this pipeline editor.

### LIS3DH and MPU6050 sources

For consistency with the literal graph model, non-Polar sources also stop carrying browser-only axis selection. Any axis choice happens in explicit representation nodes.

### Autocorrelation defaults

The firmware-default preset must not hardcode the old generic values `15` and `160` when the selected source rate is known. For the current Polar target, the preset values must be `15` and `104`.

### Effective parameter surface

The parameter model shown to users should prefer effective runtime parameters over stale or unused metadata. If the runtime ignores a field, that field should not be required for parity claims.

## Contract Unification

Preview and upload must use the same graph contract.

### Current problem

- preview sends graph JSON directly into the WASM bridge
- upload compiles the graph into protocol binary
- the compiler injects axis nodes automatically
- the WASM bridge separately encodes params and has its own browser metadata table

This creates multiple opportunities for drift.

### New rule

The compiler output becomes the canonical runtime contract after editing.

That means:

1. the editor produces one graph shape
2. the compiler converts that graph to the firmware protocol binary
3. upload sends that binary directly
4. preview runs from the same compiled structure, either by:
   - parsing the compiled binary in WASM before execution, or
   - using the exact same parameter and topology normalization code path as binary compilation

The important point is not the transport format itself. The important point is that preview and upload cannot each reinterpret the graph differently.

## Replay Data And Output Chart

Preview needs real input data if it is going to produce a meaningful output chart.

### Scope

This phase adds only one plotted output:

- final cadence estimate over time

It does not add:

- per-node signal charts
- raw X/Y/Z trace plotting as a first-class feature
- simultaneous multi-stage visualization

### Required sample data

The repository should include at least one replayable Polar log fixture captured at `52 Hz`.

The initial default fixture for this feature should come from:

- `C:\dev\_work\PaddlingPulse\analysis\logs\raw_logs\polar_log_002.csv`

That file should be copied into this repository at:

- `flow-builder/assets/replay/polar_log_002.csv`

This checked-in copy is the default replay asset that the flow builder loads automatically on page load without requiring manual file selection.

The preferred fixture format is CSV because it is easy to inspect, diff, and replace. The fixture should contain enough information to reconstruct the `raw_window` packet stream required by the WASM runtime.

For this phase, the parser must support the actual layout of `polar_log_002.csv`, which is a packed-window CSV with:

- `timestamp`
- `count`
- `x_000` through `x_511`
- `y_000` through `y_511`
- `z_000` through `z_511`

`count` defines how many samples in the row are valid. The parser should consume only the first `count` values from each axis group and ignore the unused trailing cells.

Recommended properties:

- sampled from the same Polar configuration used by the firmware
- long enough to contain several paddle strokes
- clean enough to produce a visible cadence estimate curve

### Browser data flow

The preview path should:

1. load the default checked-in CSV fixture automatically when the page opens
2. parse it into timestamped raw-window snapshots
3. convert each snapshot into the runtime input packet format expected by the WASM bridge
4. execute the compiled firmware-faithful graph once per replay snapshot
5. record the final cadence estimate emitted by the graph at each execution step
6. render that estimate as a simple time-series chart

Manual fixture replacement can be added later, but the default experience should already be runnable with the bundled `polar_log_002.csv` asset.

### Runtime data shape

The WASM bridge already expects structured packet input rather than CSV text directly. The CSV import layer is therefore a browser concern, not a WASM concern.

For the firmware-default pipeline, each CSV row should be converted into one `raw_window` input packet with:

- `sample_rate_hz = 52`
- `kind = raw_window`
- windowed `x`, `y`, `z` arrays

The preview path should treat `polar_log_002.csv` as a sequence of timestamped sample-store snapshots:

- `timestamp` is the X-axis anchor for the cadence chart
- `count` is the number of valid samples currently present in that snapshot
- the first `count` values from each axis group become the raw-window payload for that run

It should not flatten all rows into one continuous stream. Each row is already the replay window for one preview execution step.

The final chart series should be built from the last bound pipeline output, which for the default preset is the final cadence estimate from `suivi.kalman_2d`.

### UX expectation

The chart only needs to answer one question:

- what cadence estimate would this pipeline produce over the replay log?

That means a simple line chart with time on the X axis and cadence on the Y axis is sufficient for this phase.

## Catalog Generation

The checked-in catalog at `flow-builder/assets/flow-block-catalog.json` must be regenerated from the vendored firmware snapshot plus a minimal metadata layer.

The generated catalog must reflect:

- real firmware packet kinds
- real port counts
- real block IDs
- firmware-compatible param names and encodings
- fixed-value parameters when only one legal value exists

For the current target this means:

- `source.polar.outputs[0].kind = raw_window`
- `source.polar.params` includes fixed `sample_rate_hz = 52`
- `source.polar.params` does not expose `axis_mask`

## Default Preset

The builder should provide a named preset for the current firmware pipeline, for example:

- `Polar 52 Hz / Z axis / firmware default`

Loading that preset creates the exact five-node graph used by the firmware fallback path, including:

- explicit `select_axis(z)`
- `hpf_gravity(order=2)`
- derived autocorrelation lag bounds for `52 Hz`
- `kalman_2d` defaults from the firmware constants
- final output bound to the estimate output of `suivi.kalman_2d`

This preset is the main parity entry point and should be the default starting graph for this firmware target.

## Saved Graph Migration

Existing saved graphs may contain the old browser-only source abstraction:

- source nodes with `axis`
- source nodes treated as `series`
- graphs that rely on compiler-side injected representation nodes

Those graphs should be migrated on load to the explicit firmware-faithful form:

- remove source-level `axis`
- insert `representation.select_axis` or `representation.vector_magnitude` as explicit nodes where needed
- update connections and output bindings

If migration is ambiguous or invalid, the graph should fail with a clear validation message rather than silently upload a different pipeline.

## Testing Strategy

### Catalog parity tests

Add tests that compare generated browser catalog entries against the vendored firmware snapshot for:

- block IDs
- packet kinds
- source block outputs
- parameter schemas for the default pipeline blocks

### Compiler parity tests

Add a golden test for the current firmware-default Polar graph that verifies:

- exact node sequence
- exact edge count
- Polar sample rate bytes encode `52`
- autocorrelation lag bytes encode `15` and `104`
- total binary stays within `512 bytes`

### Preview/upload parity tests

Add regression tests proving that preview and upload consume the same effective graph structure and params for the default firmware preset.

### Replay tests

Add tests for the replay path that verify:

- the checked-in copy of `polar_log_002.csv` loads automatically
- the sample CSV fixture parses successfully
- `count` is respected when extracting per-row raw-window snapshots
- replay packets use `sample_rate_hz = 52`
- the default firmware preset produces a final cadence estimate series
- the plotted output is sourced from the final bound cadence estimate, not from an intermediate node

### Migration tests

Add tests for loading older saved graphs and converting them to explicit representation nodes without changing the resulting compiled pipeline.

## Success Criteria

- The editor visibly represents the same pipeline shape the firmware runs.
- Polar sample rate is fixed to `52 Hz` everywhere in the browser contract.
- The catalog no longer disagrees with firmware packet kinds for source blocks.
- Preview and upload no longer use diverging parameter or topology interpretations.
- The firmware-default Polar/Z pipeline is available as an explicit preset.
- Browser validation still enforces the OTA pipeline service limits: `16` nodes, `20` edges, `512` bytes.
