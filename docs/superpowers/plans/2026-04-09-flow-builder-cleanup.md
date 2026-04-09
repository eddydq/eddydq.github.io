# Flow Builder Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the flow builder to `/flow-builder/`, replace the local `analysis/` runtime with a firmware C snapshot plus a small WASM bridge, and remove all flow-builder files from the repository root.

**Architecture:** Keep the browser app as static HTML, CSS, and UMD/CommonJS-compatible JavaScript under `flow-builder/`. Copy firmware sources into `flow-builder/wasm/firmware/` without editing those copied files; put all browser-only adaptation in `flow-builder/wasm/pp_wasm_bridge.c`, `flow-builder/wasm/pp_hw_stubs.c`, and `flow-builder/wasm/build.ps1`. The current firmware manifest is numeric only, so the bridge must use `pp_block_get_manifest()` for firmware validation and a local metadata table for browser names, groups, ports, and parameter schemas.

**Tech Stack:** Static HTML/CSS, vanilla JavaScript, Node assertion tests, PowerShell smoke/build scripts, C99 firmware sources, Emscripten.

---

## Constraints Found During Planning

- Firmware source root: `C:\dev\_work\PaddlingPulse\firmware\app`.
- Required firmware sources are `pp_block*.c`, `pp_graph.c`, and `pp_protocol.c` plus `pp_block.h`, `pp_graph.h`, and `pp_protocol.h`.
- `pp_block.h` defines firmware block IDs `0x01` through `0x10`; `flow-builder/src/flow-compiler.js` must match them exactly.
- `PP_TARGET_WASM` removes firmware source-block exec functions from `pp_block_source.c`; `pp_hw_stubs.c` must define `pp_lis3dh_source_exec`, `pp_mpu6050_source_exec`, and `pp_polar_source_exec`.
- Existing unrelated root-site edits are present. Do not revert them; only change the path strings required by this migration.

## Target File Map

- Create/move: `flow-builder/index.html`, `flow-builder/flow.css`, `flow-builder/src/*.js`, `flow-builder/assets/flow-runtime.js`, `flow-builder/assets/flow-runtime.wasm`, `flow-builder/assets/flow-block-catalog.json`.
- Create/move: `flow-builder/tests/flow-compiler.test.js`, `flow-builder/tests/flow-ble-upload.test.js`.
- Create: `flow-builder/tests/wasm-firmware-snapshot.test.js`, `flow-builder/tests/wasm-bridge-contract.test.js`.
- Create: `flow-builder/wasm/firmware/{pp_block.c,pp_block.h,pp_block_source.c,pp_block_representation.c,pp_block_pretraitement.c,pp_block_estimation.c,pp_block_detection.c,pp_block_validation.c,pp_block_suivi.c,pp_graph.c,pp_graph.h,pp_protocol.c,pp_protocol.h}`.
- Create: `flow-builder/wasm/pp_wasm_bridge.c`, `flow-builder/wasm/pp_hw_stubs.c`, `flow-builder/wasm/build.ps1`, `flow-builder/wasm/extract-catalog.mjs`.
- Modify: `index.html`, `script.js`, `workflow-diagram.js`, `tests/*.test.js`, `tests/site-smoke.ps1`.
- Delete: `analysis/`, root `flow*` JS/CSS/HTML/test files, and root generated flow assets under `assets/`.

---

### Task 1: Move the Static Flow Builder App

**Files:**
- Create: `flow-builder/index.html`
- Create: `flow-builder/flow.css`
- Create: `flow-builder/src/flow.js`
- Create: `flow-builder/src/flow-graph.js`
- Create: `flow-builder/src/flow-catalog.js`
- Create: `flow-builder/src/flow-compiler.js`
- Create: `flow-builder/src/flow-runtime-client.js`
- Create: `flow-builder/src/flow-runtime-worker.js`
- Create: `flow-builder/src/flow-builder-viewmodel.js`
- Create: `flow-builder/src/flow-ble-upload.js`
- Create: `flow-builder/assets/flow-runtime.js`
- Create: `flow-builder/assets/flow-runtime.wasm`
- Create: `flow-builder/assets/flow-block-catalog.json`
- Create: `flow-builder/tests/flow-compiler.test.js`
- Create: `flow-builder/tests/flow-ble-upload.test.js`
- Modify: `tests/site-smoke.ps1`

- [ ] **Step 1: Update smoke test to expect the nested page**

In `tests/site-smoke.ps1`, replace the `flow.html` read with:

```powershell
$flowHtmlPath = Join-Path $root "flow-builder/index.html"
if (-not (Test-Path -LiteralPath $flowHtmlPath)) {
    throw "Missing required file: flow-builder/index.html"
}
$flowHtml = Get-Content $flowHtmlPath -Raw
```

Change the three flow-page assertion messages to reference `flow-builder/index.html`.

- [ ] **Step 2: Run the failing smoke test**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: FAIL with `Missing required file: flow-builder/index.html`.

- [ ] **Step 3: Move files**

Run:

```powershell
New-Item -ItemType Directory -Force flow-builder, flow-builder\src, flow-builder\assets, flow-builder\tests | Out-Null
Move-Item -LiteralPath flow.html -Destination flow-builder\index.html
Move-Item -LiteralPath flow.css -Destination flow-builder\flow.css
Move-Item -LiteralPath flow.js -Destination flow-builder\src\flow.js
Move-Item -LiteralPath flow-graph.js -Destination flow-builder\src\flow-graph.js
Move-Item -LiteralPath flow-catalog.js -Destination flow-builder\src\flow-catalog.js
Move-Item -LiteralPath flow-compiler.js -Destination flow-builder\src\flow-compiler.js
Move-Item -LiteralPath flow-runtime-client.js -Destination flow-builder\src\flow-runtime-client.js
Move-Item -LiteralPath flow-runtime-worker.js -Destination flow-builder\src\flow-runtime-worker.js
Move-Item -LiteralPath flow-builder-viewmodel.js -Destination flow-builder\src\flow-builder-viewmodel.js
Move-Item -LiteralPath flow-ble-upload.js -Destination flow-builder\src\flow-ble-upload.js
Move-Item -LiteralPath flow-compiler.test.js -Destination flow-builder\tests\flow-compiler.test.js
Move-Item -LiteralPath flow-ble-upload.test.js -Destination flow-builder\tests\flow-ble-upload.test.js
Move-Item -LiteralPath assets\flow-runtime.js -Destination flow-builder\assets\flow-runtime.js
Move-Item -LiteralPath assets\flow-runtime.wasm -Destination flow-builder\assets\flow-runtime.wasm
Move-Item -LiteralPath assets\flow-block-catalog.json -Destination flow-builder\assets\flow-block-catalog.json
Remove-Item -LiteralPath assets\flow-block-catalog.js
```

- [ ] **Step 4: Update `flow-builder/index.html` nested paths**

Make these replacements:

```text
href="styles.css" -> href="../styles.css"
href="index.html" -> href="../index.html"
src="assets/logo.svg" -> src="../assets/logo.svg"
src="script.js" -> src="../script.js"
src="flow-graph.js" -> src="src/flow-graph.js"
src="flow-catalog.js" -> src="src/flow-catalog.js"
src="flow-runtime-client.js" -> src="src/flow-runtime-client.js"
src="flow-compiler.js" -> src="src/flow-compiler.js"
src="flow-ble-upload.js" -> src="src/flow-ble-upload.js"
src="flow-builder-viewmodel.js" -> src="src/flow-builder-viewmodel.js"
src="flow.js" -> src="src/flow.js"
```

Remove the `<script src="assets/flow-block-catalog.js"></script>` tag.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1
```

Expected: PASS with `Static site smoke test passed.`

Commit:

```bash
git add flow-builder tests/site-smoke.ps1 assets
git commit -m "refactor: move flow builder under flow-builder"
```

---

### Task 2: Fix Nested URL Contracts and JS Tests

**Files:**
- Modify: `flow-builder/src/flow-catalog.js`
- Modify: `flow-builder/src/flow-runtime-client.js`
- Modify: `flow-builder/src/flow-runtime-worker.js`
- Modify: `flow-builder/src/flow-builder-viewmodel.js`
- Modify: `flow-builder/src/flow-compiler.js`
- Modify: `flow-builder/tests/flow-compiler.test.js`
- Modify: `flow-builder/tests/flow-ble-upload.test.js`
- Modify: `tests/flow-catalog.test.js`
- Modify: `tests/flow-graph.test.js`
- Modify: `tests/flow-runtime-client.test.js`
- Modify: `tests/flow-builder-viewmodel.test.js`
- Modify: `tests/workflow-diagram.test.js`
- Modify: `index.html`
- Modify: `script.js`
- Modify: `workflow-diagram.js`

- [ ] **Step 1: Update test imports**

Make these replacements:

```text
tests/flow-catalog.test.js: require('../flow-catalog.js') -> require('../flow-builder/src/flow-catalog.js')
tests/flow-catalog.test.js: assets/flow-block-catalog.json -> flow-builder/assets/flow-block-catalog.json
tests/flow-graph.test.js: require('../flow-graph.js') -> require('../flow-builder/src/flow-graph.js')
tests/flow-runtime-client.test.js: require('../flow-runtime-client.js') -> require('../flow-builder/src/flow-runtime-client.js')
tests/flow-builder-viewmodel.test.js: require('../flow-builder-viewmodel.js') -> require('../flow-builder/src/flow-builder-viewmodel.js')
flow-builder/tests/flow-compiler.test.js: require('./flow-compiler.js') -> require('../src/flow-compiler.js')
flow-builder/tests/flow-ble-upload.test.js: require('./flow-ble-upload.js') -> require('../src/flow-ble-upload.js')
```

- [ ] **Step 2: Add failing assertions for the new contracts**

In `flow-builder/tests/flow-compiler.test.js`, import `BLOCK_IDS` and assert:

```js
assert.equal(BLOCK_IDS['source.lis3dh'], 0x01);
assert.equal(BLOCK_IDS['source.mpu6050'], 0x02);
assert.equal(BLOCK_IDS['source.polar'], 0x03);
assert.equal(BLOCK_IDS['representation.select_axis'], 0x04);
assert.equal(BLOCK_IDS['representation.vector_magnitude'], 0x05);
assert.equal(BLOCK_IDS['pretraitement.hpf_gravity'], 0x06);
assert.equal(BLOCK_IDS['pretraitement.lowpass'], 0x07);
assert.equal(BLOCK_IDS['estimation.autocorrelation'], 0x08);
assert.equal(BLOCK_IDS['estimation.fft_dominant'], 0x09);
assert.equal(BLOCK_IDS['detection.adaptive_peak_detect'], 0x0A);
assert.equal(BLOCK_IDS['detection.zero_crossing_detect'], 0x0B);
assert.equal(BLOCK_IDS['validation.spm_range_gate'], 0x0C);
assert.equal(BLOCK_IDS['validation.peak_selector'], 0x0D);
assert.equal(BLOCK_IDS['validation.confidence_gate'], 0x0E);
assert.equal(BLOCK_IDS['suivi.kalman_2d'], 0x0F);
assert.equal(BLOCK_IDS['suivi.confirmation_filter'], 0x10);
```

In `tests/flow-runtime-client.test.js`, add a default-worker assertion that expects `src/flow-runtime-worker.js`.

In `tests/flow-builder-viewmodel.test.js`, add a `source.polar` catalog block and expect palette groups `['source', 'representation', 'estimation', 'validation']`.

In `tests/workflow-diagram.test.js`, change the expected DSP navigation action to `{ type: 'navigate', href: 'flow-builder/' }`.

- [ ] **Step 3: Run tests to confirm failures**

Run:

```powershell
node tests\flow-catalog.test.js
node tests\flow-runtime-client.test.js
node tests\flow-builder-viewmodel.test.js
node tests\workflow-diagram.test.js
node flow-builder\tests\flow-compiler.test.js
node flow-builder\tests\flow-ble-upload.test.js
```

Expected: failures mention the old worker URL, missing `source` group, or old `flow.html` link.

- [ ] **Step 4: Update implementation paths**

Make these implementation changes:

```text
flow-builder/src/flow-runtime-client.js:
new Worker(options.workerUrl || 'flow-runtime-worker.js') -> new Worker(options.workerUrl || 'src/flow-runtime-worker.js')

flow-builder/src/flow-runtime-worker.js:
importScripts('assets/flow-runtime.js') -> importScripts('../assets/flow-runtime.js')

flow-builder/src/flow-builder-viewmodel.js:
GROUP_ORDER = ['representation', 'pretraitement', 'estimation', 'detection', 'validation', 'suivi']
-> GROUP_ORDER = ['source', 'representation', 'pretraitement', 'estimation', 'detection', 'validation', 'suivi']

flow-builder/src/flow-catalog.js:
keep fetch path exactly 'assets/flow-block-catalog.json'
```

Verify `flow-builder/src/flow-compiler.js` has the full 16-entry firmware ID mapping from the spec.

- [ ] **Step 5: Update site links**

Make these replacements:

```text
index.html: href="flow.html" -> href="flow-builder/"
script.js: href=\"flow.html\" -> href=\"flow-builder/\"
script.js: href="flow.html" -> href="flow-builder/"
workflow-diagram.js: href: 'flow.html' -> href: 'flow-builder/'
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node tests\flow-catalog.test.js
node tests\flow-graph.test.js
node tests\flow-runtime-client.test.js
node tests\flow-builder-viewmodel.test.js
node tests\workflow-diagram.test.js
node flow-builder\tests\flow-compiler.test.js
node flow-builder\tests\flow-ble-upload.test.js
powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1
```

Expected: all commands pass.

Commit:

```bash
git add flow-builder index.html script.js workflow-diagram.js tests
git commit -m "fix: update flow builder nested paths"
```

---

### Task 3: Copy Firmware Snapshot

**Files:**
- Create: `flow-builder/wasm/firmware/*`
- Create: `flow-builder/tests/wasm-firmware-snapshot.test.js`

- [ ] **Step 1: Write the failing snapshot test**

Create `flow-builder/tests/wasm-firmware-snapshot.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '..', 'wasm', 'firmware');
const files = [
    'pp_block.c', 'pp_block.h', 'pp_block_source.c', 'pp_block_representation.c',
    'pp_block_pretraitement.c', 'pp_block_estimation.c', 'pp_block_detection.c',
    'pp_block_validation.c', 'pp_block_suivi.c', 'pp_graph.c', 'pp_graph.h',
    'pp_protocol.c', 'pp_protocol.h'
];

for (const file of files) {
    assert.ok(fs.existsSync(path.join(dir, file)), `missing firmware snapshot file: ${file}`);
}

const blockHeader = fs.readFileSync(path.join(dir, 'pp_block.h'), 'utf8');
assert.match(blockHeader, /PP_BLOCK_LIS3DH_SOURCE\s*=\s*0x01/);
assert.match(blockHeader, /PP_BLOCK_CONFIRMATION\s*=\s*0x10/);
assert.match(blockHeader, /PP_BLOCK_COUNT\s*=\s*16/);

console.log('Firmware snapshot test passed.');
```

- [ ] **Step 2: Run the failing test**

Run: `node flow-builder\tests\wasm-firmware-snapshot.test.js`

Expected: FAIL with `missing firmware snapshot file: pp_block.c`.

- [ ] **Step 3: Copy firmware files**

Run:

```powershell
New-Item -ItemType Directory -Force flow-builder\wasm\firmware | Out-Null
$fw = 'C:\dev\_work\PaddlingPulse\firmware\app'
$copies = @(
    @{ Source = 'src\pp_block.c'; Destination = 'pp_block.c' },
    @{ Source = 'include\pp_block.h'; Destination = 'pp_block.h' },
    @{ Source = 'src\pp_block_source.c'; Destination = 'pp_block_source.c' },
    @{ Source = 'src\pp_block_representation.c'; Destination = 'pp_block_representation.c' },
    @{ Source = 'src\pp_block_pretraitement.c'; Destination = 'pp_block_pretraitement.c' },
    @{ Source = 'src\pp_block_estimation.c'; Destination = 'pp_block_estimation.c' },
    @{ Source = 'src\pp_block_detection.c'; Destination = 'pp_block_detection.c' },
    @{ Source = 'src\pp_block_validation.c'; Destination = 'pp_block_validation.c' },
    @{ Source = 'src\pp_block_suivi.c'; Destination = 'pp_block_suivi.c' },
    @{ Source = 'src\pp_graph.c'; Destination = 'pp_graph.c' },
    @{ Source = 'include\pp_graph.h'; Destination = 'pp_graph.h' },
    @{ Source = 'src\pp_protocol.c'; Destination = 'pp_protocol.c' },
    @{ Source = 'include\pp_protocol.h'; Destination = 'pp_protocol.h' }
)
foreach ($copy in $copies) {
    Copy-Item -LiteralPath (Join-Path $fw $copy.Source) -Destination (Join-Path 'flow-builder\wasm\firmware' $copy.Destination)
}
```

- [ ] **Step 4: Verify and commit**

Run: `node flow-builder\tests\wasm-firmware-snapshot.test.js`

Expected: PASS with `Firmware snapshot test passed.`

Commit:

```bash
git add flow-builder/wasm/firmware flow-builder/tests/wasm-firmware-snapshot.test.js
git commit -m "feat: add firmware snapshot for flow builder wasm"
```

---

### Task 4: Add WASM Bridge, Stubs, Build Script, and Catalog Generation

**Files:**
- Create: `flow-builder/wasm/pp_hw_stubs.c`
- Create: `flow-builder/wasm/pp_wasm_bridge.c`
- Create: `flow-builder/wasm/build.ps1`
- Create: `flow-builder/wasm/extract-catalog.mjs`
- Create: `flow-builder/tests/wasm-bridge-contract.test.js`
- Modify: `flow-builder/assets/flow-block-catalog.json`
- Generate: `flow-builder/assets/flow-runtime.js`
- Generate: `flow-builder/assets/flow-runtime.wasm`

- [ ] **Step 1: Write bridge contract test**

Create `flow-builder/tests/wasm-bridge-contract.test.js` with assertions that:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'wasm', 'pp_wasm_bridge.c'), 'utf8');
const stubs = fs.readFileSync(path.join(root, 'wasm', 'pp_hw_stubs.c'), 'utf8');

assert.match(bridge, /pp_wasm_catalog_json/);
assert.match(bridge, /pp_wasm_run_graph_json/);
assert.match(bridge, /pp_wasm_last_result_json/);
assert.match(bridge, /pp_block_get_manifest/);
for (const id of [
    'source.lis3dh', 'source.mpu6050', 'source.polar',
    'representation.select_axis', 'representation.vector_magnitude',
    'pretraitement.hpf_gravity', 'pretraitement.lowpass',
    'estimation.autocorrelation', 'estimation.fft_dominant',
    'detection.adaptive_peak_detect', 'detection.zero_crossing_detect',
    'validation.spm_range_gate', 'validation.peak_selector', 'validation.confidence_gate',
    'suivi.kalman_2d', 'suivi.confirmation_filter'
]) {
    assert.match(bridge, new RegExp(id.replace('.', '\\.')));
}
assert.doesNotMatch(bridge, /analysis\//);
assert.match(stubs, /pp_lis3dh_source_exec/);
assert.match(stubs, /pp_mpu6050_source_exec/);
assert.match(stubs, /pp_polar_source_exec/);
assert.match(stubs, /PP_SKIP/);
console.log('WASM bridge contract test passed.');
```

- [ ] **Step 2: Run failing contract test**

Run: `node flow-builder\tests\wasm-bridge-contract.test.js`

Expected: FAIL because bridge files do not exist.

- [ ] **Step 3: Add source stubs**

Create `flow-builder/wasm/pp_hw_stubs.c` defining `pp_lis3dh_source_exec`, `pp_mpu6050_source_exec`, and `pp_polar_source_exec`. Each function ignores inputs, sets `outputs[0]` to an empty `PP_KIND_RAW_WINDOW` packet when an output is available, and returns `{ .status = PP_SKIP }`.

- [ ] **Step 4: Add bridge**

Create `flow-builder/wasm/pp_wasm_bridge.c` with:

```c
#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "pp_block.h"
#include "pp_graph.h"
#include "pp_protocol.h"
```

Implement these exact exported functions:

```c
const char *pp_wasm_catalog_json(void);
int pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json);
const char *pp_wasm_last_result_json(void);
```

The bridge metadata table must contain all 16 browser IDs from the bridge contract test. For each entry, store numeric firmware block ID, dotted browser block ID, display name, group name, up to three input names, up to three output names, and parameter schemas. Use firmware `pp_block_get_manifest(block_id)` while serializing the catalog so a missing firmware block cannot silently appear in the UI.

For execution, parse `schema_version`, `nodes`, `connections`, and `outputs` from the serialized graph JSON. Build a `pp_graph_t`, map browser block IDs to firmware IDs, encode params using the same byte layout as `flow-builder/src/flow-compiler.js`, run `pp_graph_topo_sort()` and `pp_graph_validate_ports()` for node-to-node edges, inject `input.<binding>` packets from `inputs_json` into destination inputs, execute nodes in topological order with `pp_block_exec()`, and cache `{"outputs":...,"diagnostics":...}` in a static result buffer. Return `0` on success and `1` with `{"error":"..."}` cached on failure.

- [ ] **Step 5: Add catalog extraction script**

Create `flow-builder/wasm/extract-catalog.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import runtimeModuleFactory from './runtime-catalog-node.mjs';

const runtime = await runtimeModuleFactory();
const json = runtime.UTF8ToString(runtime._pp_wasm_catalog_json());
const parsed = JSON.parse(json);
if (!Array.isArray(parsed.blocks) || parsed.blocks.length !== 16) {
    throw new Error(`expected 16 firmware blocks, got ${parsed.blocks && parsed.blocks.length}`);
}
const outPath = path.resolve('flow-builder/assets/flow-block-catalog.json');
fs.writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
console.log(`wrote ${outPath}`);
```

- [ ] **Step 6: Add build script**

Create `flow-builder/wasm/build.ps1` with targets `build`, `catalog`, and `clean`. The `build` target compiles all `flow-builder/wasm/firmware/*.c` plus `pp_wasm_bridge.c` and `pp_hw_stubs.c` with `-DPP_TARGET_WASM`, `-sMODULARIZE=1`, `-sEXPORT_NAME=createFlowRuntimeModule`, `-sALLOW_MEMORY_GROWTH=0`, `-sSTACK_SIZE=262144`, and exported functions `_pp_wasm_catalog_json,_pp_wasm_run_graph_json,_pp_wasm_last_result_json,_malloc,_free`. The `catalog` target builds a Node runtime as `flow-builder/wasm/runtime-catalog-node.mjs` and runs `node flow-builder/wasm/extract-catalog.mjs`. The `clean` target removes `flow-builder/assets/flow-runtime.js`, `flow-builder/assets/flow-runtime.wasm`, `flow-builder/wasm/runtime-catalog-node.mjs`, and `flow-builder/wasm/runtime-catalog-node.wasm`.

- [ ] **Step 7: Verify bridge and build**

Run:

```powershell
node flow-builder\tests\wasm-bridge-contract.test.js
powershell -ExecutionPolicy Bypass -File flow-builder\wasm\build.ps1 -Target clean
powershell -ExecutionPolicy Bypass -File flow-builder\wasm\build.ps1 -Target build
powershell -ExecutionPolicy Bypass -File flow-builder\wasm\build.ps1 -Target catalog
node tests\flow-catalog.test.js
```

Expected when `emcc` is installed: all commands pass, generated runtime files exist under `flow-builder/assets/`, and catalog JSON contains 16 blocks.

- [ ] **Step 8: Commit**

```bash
git add flow-builder/wasm flow-builder/tests/wasm-bridge-contract.test.js flow-builder/assets
git commit -m "feat: add firmware wasm bridge"
```

---

### Task 5: Delete `analysis/` and Legacy Root Flow Files

**Files:**
- Modify: `tests/site-smoke.ps1`
- Delete: `analysis/`
- Delete: remaining root flow-builder files and root generated flow assets.

- [ ] **Step 1: Add forbidden-path smoke checks**

Append this before the final `Write-Host` in `tests/site-smoke.ps1`:

```powershell
$forbiddenPaths = @(
    "analysis",
    "flow.html",
    "flow.css",
    "flow.js",
    "flow-graph.js",
    "flow-catalog.js",
    "flow-compiler.js",
    "flow-runtime-client.js",
    "flow-runtime-worker.js",
    "flow-builder-viewmodel.js",
    "flow-ble-upload.js",
    "flow-compiler.test.js",
    "flow-ble-upload.test.js",
    "assets/flow-runtime.js",
    "assets/flow-runtime.wasm",
    "assets/flow-block-catalog.json",
    "assets/flow-block-catalog.js"
)
foreach ($path in $forbiddenPaths) {
    if (Test-Path -LiteralPath (Join-Path $root $path)) {
        throw "Unexpected legacy flow-builder path remains: $path"
    }
}
```

- [ ] **Step 2: Run failing smoke check**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: FAIL with `Unexpected legacy flow-builder path remains: analysis`.

- [ ] **Step 3: Delete legacy paths safely**

Run:

```powershell
$repo = (Resolve-Path .).Path
$analysisPath = Resolve-Path -LiteralPath analysis
if (-not $analysisPath.Path.StartsWith($repo)) {
    throw "Refusing to delete outside repository: $($analysisPath.Path)"
}
Remove-Item -LiteralPath $analysisPath.Path -Recurse

$leftovers = @(
    "flow.html", "flow.css", "flow.js", "flow-graph.js", "flow-catalog.js",
    "flow-compiler.js", "flow-runtime-client.js", "flow-runtime-worker.js",
    "flow-builder-viewmodel.js", "flow-ble-upload.js", "flow-compiler.test.js",
    "flow-ble-upload.test.js", "assets/flow-runtime.js", "assets/flow-runtime.wasm",
    "assets/flow-block-catalog.json", "assets/flow-block-catalog.js"
)
foreach ($path in $leftovers) {
    $fullPath = Join-Path $repo $path
    if (Test-Path -LiteralPath $fullPath) {
        Remove-Item -LiteralPath $fullPath
    }
}
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
node tests\flow-catalog.test.js
node tests\flow-graph.test.js
node tests\flow-runtime-client.test.js
node tests\flow-builder-viewmodel.test.js
node tests\workflow-diagram.test.js
node tests\simple-flowchart.test.js
node flow-builder\tests\flow-compiler.test.js
node flow-builder\tests\flow-ble-upload.test.js
node flow-builder\tests\wasm-firmware-snapshot.test.js
node flow-builder\tests\wasm-bridge-contract.test.js
powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add -A analysis flow-builder tests assets index.html script.js workflow-diagram.js
git commit -m "chore: remove legacy flow builder runtime"
```

---

## Final Verification

- [ ] Run `powershell -ExecutionPolicy Bypass -File flow-builder\wasm\build.ps1 -Target build`.
- [ ] Run `powershell -ExecutionPolicy Bypass -File flow-builder\wasm\build.ps1 -Target catalog`.
- [ ] Run every Node and PowerShell test listed in Task 5 Step 4.
- [ ] Run `git status --short` and confirm only intentional files are changed.

## Self-Review

- Consolidate into `flow-builder/`: Tasks 1 and 2.
- Firmware C snapshot replaces local C blocks: Task 3.
- Fresh WASM bridge and build pipeline: Task 4.
- Delete `analysis/`: Task 5.
- Clean URL `/flow-builder/`: Task 2.
- All 16 firmware blocks in palette: Task 2 and Task 4.
- No root flow-builder files remain: Task 5.

Plan complete and saved to `docs/superpowers/plans/2026-04-09-flow-builder-cleanup.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
