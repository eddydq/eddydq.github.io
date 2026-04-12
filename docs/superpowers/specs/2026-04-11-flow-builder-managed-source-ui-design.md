# Flow Builder Managed Source UI Design

**Date:** 2026-04-11
**Status:** Draft

## Problem

The flow builder currently exposes source choice and axis selection as ordinary graph nodes:

- three separate source blocks can be added to the canvas
- `representation.select_axis` can be added separately
- `representation.vector_magnitude` is available as another raw-window-to-series branch

That editing model conflicts with the current product constraint:

- there must always be exactly one source
- there must always be exactly one axis selection
- the intended firmware-backed workflow is based on one 512-sample raw window at a time, not multiple parallel source branches

The current UI therefore allows invalid or misleading configurations even though the underlying firmware/runtime logic already works for the single-source pipeline the product needs.

## Goals

1. Replace the user-visible source/axis editing model with one permanent `Source` block.
2. Keep the underlying saved graph and runtime logic explicit as `source.* -> representation.select_axis`.
3. Enforce exactly one source and exactly one axis choice in normal editing.
4. Restrict source parameter choices to firmware-supported enums instead of free-form numeric entry.
5. Remove `representation.vector_magnitude` from the UI surface for new graphs.
6. Keep `Cadence Output` as the existing permanent output block.

## Non-Goals

- Do not change the firmware graph execution model.
- Do not change the compiler binary format or OTA protocol.
- Do not change the WASM block implementations.
- Do not add support for multiple simultaneous source streams.
- Do not redesign the rest of the canvas interaction model.

## Source Of Truth

The supported source parameter options come from the firmware source caps in:

- `C:\dev\_work\PaddlingPulse\firmware\app\src\pp_block_source.c`
- mirrored in this repo at `flow-builder/wasm/firmware/pp_block_source.c`

As verified on 2026-04-11, the available options are:

### LIS3DH

- `sample_rate_hz`: `1`, `10`, `25`, `50`, `100`, `200`, `400`
- `resolution`: `8`, `10`, `12`
- `axis`: `x`, `y`, `z`

### MPU6050

- `sample_rate_hz`: `4`, `10`, `25`, `50`, `100`, `200`, `400`, `1000`
- `resolution`: `16`
- `axis`: `x`, `y`, `z`

### Polar

- `sample_rate_hz`: `52`
- `resolution`: `16`
- `axis`: `x`, `y`, `z`

## Design Summary

The editor UI stops showing source and axis as ordinary user-managed nodes.

Instead, the page owns one permanent `Source` system block whose visible controls map onto one hidden source node and one hidden `representation.select_axis` node inside the graph state.

The graph contract remains explicit and firmware-faithful at serialization, preview execution, and upload time:

- hidden source node outputs `raw_window`
- hidden `representation.select_axis` consumes that `raw_window`
- the visible `Source` block exposes the resulting `series` output

This preserves the existing node logic while removing a UI that suggests unsupported topology freedom.

## Visible UI Model

### Permanent Source Block

The left side of the canvas should contain a permanent, non-deletable `Source` block, parallel to the existing permanent `Cadence Output` block.

That block exposes four controls:

- `source`
- `sample_rate_hz`
- `resolution`
- `axis`

The block exposes one output socket:

- `primary`
- output kind: `series`

The user should wire downstream preprocessing and estimation blocks from this `series` output and should not see the hidden raw-window source output directly.

### Control Types

All source controls should be discrete selection controls, not free-form numeric inputs.

- `source`: enum select
- `sample_rate_hz`: enum select
- `resolution`: enum select
- `axis`: enum select

If a selected source only supports one value for a field, the UI should still show that field but render it as fixed and non-editable.

Examples:

- Polar shows `sample_rate_hz = 52`
- Polar shows `resolution = 16`
- MPU6050 shows `resolution = 16`

### Palette Changes

The palette must no longer offer:

- `source.lis3dh`
- `source.mpu6050`
- `source.polar`
- `representation.select_axis`
- `representation.vector_magnitude`

All other blocks remain available in the palette.

## Hidden Graph Model

The UI abstraction does not change the underlying graph shape stored and executed by the builder.

The page owns exactly two hidden nodes for the managed source block:

1. one source node of type `source.lis3dh`, `source.mpu6050`, or `source.polar`
2. one `representation.select_axis` node

Those nodes are connected internally as:

`source.*.primary -> representation.select_axis.source`

The visible `Source.primary` socket corresponds to:

- `representation.select_axis.primary`

The user never directly manipulates those two nodes on the canvas, but they remain present in the graph data model used for:

- serialization
- preview replay normalization
- runtime execution
- upload compilation

## Editor Rules

### Single-Source Invariant

Normal editing must always satisfy:

- exactly one hidden source node
- exactly one hidden `representation.select_axis` node

The user cannot delete the managed source block, duplicate it, or create another source path through the palette.

### Parameter Synchronization

Changing the visible `Source` block updates the hidden nodes as follows:

- changing `source` swaps the hidden source node `block_id`
- changing `sample_rate_hz` updates hidden source params
- changing `resolution` updates hidden source params
- changing `axis` updates hidden `representation.select_axis.params.axis`

When `source` changes, the page must refresh the allowed values for `sample_rate_hz` and `resolution` immediately.

If the previous value is invalid for the new source, the page must coerce it to the source default already used by the existing block catalog:

- LIS3DH: `sample_rate_hz = 100`, `resolution = 12`
- MPU6050: `sample_rate_hz = 100`, `resolution = 16`
- Polar: `sample_rate_hz = 52`, `resolution = 16`

Axis should remain unchanged across source switches unless it is missing or invalid, in which case it should fall back to `z`.

### Output Kind

The permanent `Source` block must expose `series`, not `raw_window`.

This is intentional: the UI is promising a managed single-axis source, not a raw multi-axis packet.

## Compatibility With Earlier Parity Work

This design intentionally changes the visible editor contract from the April 9 parity design.

The April 9 design required the editor canvas to show the literal firmware graph. This April 11 design narrows that requirement:

- the stored graph remains literal
- the compiled graph remains literal
- preview and upload remain literal
- only the canvas presentation becomes managed and higher-level

This keeps firmware/runtime parity while removing a UI that no longer matches the product constraints.

## Existing Graph Handling

### Supported Existing Graphs

If a saved graph contains exactly:

- one source node
- one `representation.select_axis` node fed by that source node
- no other user-visible source blocks

the page should load it into the managed `Source` UI and hide those two nodes from the canvas.

### Unsupported Existing Graphs

If a saved graph contains any of the following:

- zero source nodes
- more than one source node
- zero axis-selection nodes for the managed source path
- more than one axis-selection node for the managed source path
- `representation.vector_magnitude`
- source topology that cannot be mapped to the single managed source block

the builder should fail with a clear compatibility/validation message instead of silently rewriting the graph into a different topology.

This keeps the UI honest and avoids destructive guessing.

## Testing Strategy

Add regression coverage for:

- permanent source block rendering when the page loads
- source palette entries being absent
- `representation.select_axis` and `representation.vector_magnitude` being absent from the palette
- visible source controls using enum selections instead of numeric free-form fields
- firmware-backed option lists per source:
  - LIS3DH rates and resolutions
  - MPU6050 rates and resolutions
  - Polar fixed rate and resolution
- hidden graph synchronization when the user changes source, sample rate, resolution, or axis
- enforcing exactly one managed source path in normal editing
- rejecting incompatible saved graphs with multiple source or axis nodes
- preserving the explicit hidden graph shape for preview and upload code paths

## Success Criteria

- The canvas always contains one visible permanent `Source` block.
- Users can no longer add or delete source nodes or axis nodes directly.
- `sample_rate_hz` is always chosen from firmware-supported options and is never free-form.
- The visible `Source` block drives exactly one hidden explicit `source.* -> representation.select_axis` path.
- The builder still serializes and executes the existing explicit graph logic without firmware or compiler changes.
