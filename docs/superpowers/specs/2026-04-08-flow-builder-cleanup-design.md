# Flow Builder Cleanup & Restructure

**Date:** 2026-04-08
**Status:** Draft

## Problem

The flow builder is janky, its files are scattered across the project root, and the C block implementations have diverged from the firmware's authoritative versions. The `analysis/` folder contains parallel Python and C implementations that are no longer needed — the firmware repo (`C:\dev\_work\PaddlingPulse\firmware`) is the single source of truth for all block logic.

## Goals

1. Consolidate the flow builder into a self-contained `flow-builder/` folder with clean subfolders
2. Replace all local C block implementations with copies from the firmware repo
3. Delete the entire `analysis/` folder (backed up elsewhere and in git history)
4. Write a fresh, minimal WASM bridge to compile firmware C sources for the browser
5. Clean URL: `eddydq.github.io/flow-builder/`

## Folder Structure

```
flow-builder/
├── index.html                    # flow builder page (was root flow.html)
├── flow.css                      # flow builder styles
├── src/                          # JS modules
│   ├── flow.js                   # main controller (drag-drop, localStorage)
│   ├── flow-graph.js             # graph data model & serialization
│   ├── flow-catalog.js           # block catalog loader
│   ├── flow-compiler.js          # graph → binary compiler for DA14531
│   ├── flow-runtime-client.js    # WebWorker communication layer
│   ├── flow-runtime-worker.js    # WebWorker (loads WASM module)
│   ├── flow-builder-viewmodel.js # UI model, block groups, socket positioning
│   └── flow-ble-upload.js        # BLE upload to DA14531
├── wasm/                         # C sources + Emscripten build
│   ├── firmware/                 # copied from firmware repo (snapshot)
│   │   ├── pp_block.c            # block dispatcher & registry
│   │   ├── pp_block.h            # block interface definitions
│   │   ├── pp_block_source.c     # source blocks (stubbed for WASM)
│   │   ├── pp_block_representation.c
│   │   ├── pp_block_pretraitement.c
│   │   ├── pp_block_estimation.c
│   │   ├── pp_block_detection.c
│   │   ├── pp_block_validation.c
│   │   ├── pp_block_suivi.c
│   │   ├── pp_graph.c            # graph execution engine
│   │   ├── pp_graph.h            # graph data structures
│   │   ├── pp_protocol.c         # binary protocol parsing (needed by pp_graph.c)
│   │   └── pp_protocol.h         # protocol definitions
│   ├── pp_wasm_bridge.c          # WASM entry points (fresh)
│   ├── pp_hw_stubs.c             # hardware stubs (I2C, BLE, GPIO)
│   └── build.ps1                 # Emscripten build script
└── assets/                       # build output (committed)
    ├── flow-runtime.js           # Emscripten glue code
    ├── flow-runtime.wasm         # compiled WASM binary
    └── flow-block-catalog.json   # generated block catalog
```

## What Gets Deleted

### Entire `analysis/` folder
- `analysis/algorithms/` — Python and C reference implementations (6 categories)
- `analysis/c_api/` — header-only API (replaced by firmware headers)
- `analysis/c_runtime/` — runtime engine (replaced by firmware's pp_graph.c)
- `analysis/c_blocks/` — block implementations (replaced by firmware copies)
- `analysis/wasm/` — old WASM bridge and build scripts (replaced by fresh bridge)
- `analysis/scripts/` — Python block model and test runners
- `analysis/tests/` — Python test suite
- `analysis/pipelines/`, `analysis/logs/`, `analysis/results/`

### Root-level flow files (moved into `flow-builder/`)
- `flow.html` → `flow-builder/index.html`
- `flow.css` → `flow-builder/flow.css`
- `flow.js`, `flow-graph.js`, `flow-catalog.js`, `flow-compiler.js` → `flow-builder/src/`
- `flow-runtime-client.js`, `flow-runtime-worker.js` → `flow-builder/src/`
- `flow-builder-viewmodel.js`, `flow-ble-upload.js` → `flow-builder/src/`
- `flow-ble-upload.test.js`, `flow-compiler.test.js` → `flow-builder/tests/` (if they exist at root)

### Root-level `assets/` folder (output moves to `flow-builder/assets/`)
- `assets/flow-runtime.js`, `assets/flow-runtime.wasm`
- `assets/flow-block-catalog.js`, `assets/flow-block-catalog.json`

## What Stays Untouched

- `index.html`, `script.js`, `styles.css` — main marketing site
- `simple-flowchart.js`, `workflow-diagram.js` — diagrams tied to main site
- `build_mermaid.js`, `mermaid_test.txt`, `test_mermaid.html` — mermaid experiments
- `docs/`, `.worktrees/`

### Requires path updates
- `tests/` — JS test files that import flow modules need paths updated from `../flow-*.js` to `../flow-builder/src/flow-*.js`
- `tests/site-smoke.ps1` — references to `flow.html` must change to `flow-builder/index.html`
- `tests/workflow-diagram.test.js` — navigation href `flow.html` must change to `flow-builder/`

## WASM Bridge Design

### `pp_wasm_bridge.c` — Browser entry points

Three exported functions for the JS WebWorker:

- **`pp_wasm_catalog_json()`** — iterates the firmware's block registry via `pp_block_get_manifest()`, serializes all block metadata (id, name, group, inputs, outputs, parameters) to a JSON string, returns pointer to static buffer.

- **`pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json)`** — deserializes a graph definition and input data from JSON, constructs `pp_graph_t`, calls the firmware's graph execution engine, serializes results to JSON, caches in static buffer.

- **`pp_wasm_last_result_json()`** — returns pointer to cached result from last `run_graph` call.

### `pp_hw_stubs.c` — Hardware abstraction stubs

Replaces hardware-specific calls so firmware code compiles under Emscripten:

- I2C read/write → no-op, returns zeros
- BLE functions → no-op
- Source blocks (LIS3DH, MPU6050, Polar) → return `PP_BLOCK_SKIP` so the graph engine skips them. In the browser, raw sensor data is injected via the JSON inputs parameter instead of read from hardware.

### `build.ps1` — Emscripten build script

Targets:
- `build` — compiles all `firmware/*.c` + `pp_wasm_bridge.c` + `pp_hw_stubs.c` → `assets/flow-runtime.{js,wasm}`
- `catalog` — runs compiled WASM in Node.js to extract `assets/flow-block-catalog.json`
- `clean` — removes build artifacts

Emscripten flags:
- `-DPP_TARGET_WASM` (activates WASM guards in firmware sources, stubs hardware includes)
- `-s EXPORTED_FUNCTIONS=['_pp_wasm_catalog_json','_pp_wasm_run_graph_json','_pp_wasm_last_result_json','_malloc','_free']`
- `-s ALLOW_MEMORY_GROWTH=0` (fixed memory, matches firmware constraints)
- Fixed stack size

## JS Module Updates

### Path updates (all modules)
All `<script src="">` references in `index.html` updated to `src/` relative paths. Internal module imports updated for new directory layout.

Additionally, `index.html` (was `flow.html`) references root-level resources that need updating:
- `<link href="styles.css">` → `<link href="../styles.css">`
- `<script src="script.js">` → `<script src="../script.js">` (i18n/translations)
- `<img src="assets/logo.svg">` → `<img src="../assets/logo.svg">`
- `<script src="assets/flow-block-catalog.js">` — drop the embedded `.js` catalog; use only the JSON fetch path in `flow-catalog.js`

### `flow-compiler.js` — BLOCK_IDS sync
The `BLOCK_IDS` enum must exactly match the firmware's block IDs:
```
LIS3DH_SOURCE    = 0x01    MPU6050_SOURCE     = 0x02
POLAR_SOURCE     = 0x03    SELECT_AXIS        = 0x04
VECTOR_MAG       = 0x05    HPF_GRAVITY        = 0x06
LOWPASS          = 0x07    AUTOCORRELATION    = 0x08
FFT_DOMINANT     = 0x09    ADAPTIVE_PEAK      = 0x0A
ZERO_CROSSING    = 0x0B    SPM_RANGE_GATE     = 0x0C
PEAK_SELECTOR    = 0x0D    CONFIDENCE_GATE    = 0x0E
KALMAN_2D        = 0x0F    CONFIRMATION       = 0x10
```

### `flow-builder-viewmodel.js` — block groups
Update to include all 7 firmware groups: source, representation, pretraitement, estimation, detection, validation, suivi. Note: source blocks will appear in the palette for graph completeness but are non-functional in browser simulation (they return `PP_BLOCK_SKIP`; raw data is injected via JSON inputs).

### `flow-runtime-worker.js` — WASM path
Update import path to `../assets/flow-runtime.js`.

### `flow-runtime-client.js` — worker path
Update worker path to `src/flow-runtime-worker.js`.

### `flow-catalog.js` — catalog path
Update catalog fetch path to `../assets/flow-block-catalog.json` or `assets/flow-block-catalog.json` relative to `index.html`.

## Main Site Link Update

`index.html` (root) — update link to flow builder from `flow.html` to `flow-builder/`.

## Data Flow Summary

```
User interaction (browser)
  └── flow-builder/index.html
      └── src/flow.js (controller)
          ├── src/flow-catalog.js → assets/flow-block-catalog.json
          ├── src/flow-graph.js (graph model)
          ├── src/flow-builder-viewmodel.js (UI groups)
          ├── src/flow-runtime-client.js → WebWorker
          │   └── src/flow-runtime-worker.js → assets/flow-runtime.wasm
          ├── src/flow-compiler.js → binary graph
          └── src/flow-ble-upload.js → BLE → DA14531

Build pipeline:
  wasm/firmware/*.c (from C:\dev\_work\PaddlingPulse\firmware)
  + wasm/pp_wasm_bridge.c + wasm/pp_hw_stubs.c
  → emcc (wasm/build.ps1)
  → assets/flow-runtime.{js,wasm} + assets/flow-block-catalog.json
```

## Firmware Sync Strategy

The firmware C files in `flow-builder/wasm/firmware/` are a point-in-time copy. When the firmware evolves:

1. Copy updated files from `C:\dev\_work\PaddlingPulse\firmware\app\src\` and `include\`
2. Run `build.ps1` to recompile WASM
3. Update `BLOCK_IDS` in `flow-compiler.js` if new blocks were added
4. Update `flow-builder-viewmodel.js` if new groups were added
5. Commit the updated files

## Success Criteria

- Flow builder loads at `eddydq.github.io/flow-builder/`
- All 16 firmware blocks appear in the UI palette organized by group
- Graph building, connection, and parameter editing work as before
- WASM simulation runs graphs using firmware's execution engine
- Binary compilation and BLE upload produce correct firmware-compatible output
- `analysis/` folder is gone
- No flow builder files remain at the project root
