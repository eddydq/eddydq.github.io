# Firmware System Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current firmware architecture Mermaid card with a fixed-size overview/detail experience that tells a clean high-level story, supports multi-open detail lanes, and maps the expanded views back to the real firmware runtime.

**Architecture:** Keep Mermaid as the rendering engine, but replace the single `expandedFlow` string with a richer view-state model: overview mode vs detail mode plus per-lane open state for `imu`, `dsp`, and `ble`. Generate Mermaid definitions from pure functions in `workflow-diagram.js`, then let `script.js` translate click targets into state transitions while the page keeps a stable diagram frame and smooth in-place transitions.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Mermaid 10, Node assertion script, PowerShell smoke test.

---

### Task 1: Introduce a state model for overview/detail and per-lane expansion

**Files:**
- Modify: `workflow-diagram.js`
- Modify: `tests/workflow-diagram.test.js`

- [ ] **Step 1: Write the failing test**

Extend `tests/workflow-diagram.test.js` so it stops testing a single `expandedFlow` string and starts testing the state model the page needs.

```js
const assert = require('node:assert/strict');

const {
    createFlowchartState,
    transitionFlowchartState,
    getFlowchartActionFromClassName
} = require('../workflow-diagram.js');

const overviewState = createFlowchartState();
assert.deepStrictEqual(overviewState, {
    mode: 'overview',
    openLanes: { imu: false, dsp: false, ble: false }
});

const detailState = transitionFlowchartState(
    overviewState,
    { type: 'open-detail', lane: 'imu' }
);

assert.deepStrictEqual(detailState, {
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: false }
});

const multiOpenState = transitionFlowchartState(
    detailState,
    { type: 'expand-lane', lane: 'ble' }
);

assert.deepStrictEqual(multiOpenState, {
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: true }
});

const collapsedState = transitionFlowchartState(
    multiOpenState,
    { type: 'collapse-lane', lane: 'imu' }
);

assert.deepStrictEqual(collapsedState, {
    mode: 'detail',
    openLanes: { imu: false, dsp: false, ble: true }
});

assert.deepStrictEqual(
    transitionFlowchartState(collapsedState, { type: 'back-overview' }),
    {
        mode: 'overview',
        openLanes: { imu: false, dsp: false, ble: false }
    }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeOverviewImu'),
    { type: 'open-detail', lane: 'imu' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeLaneBle'),
    { type: 'expand-lane', lane: 'ble' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default laneCloseDsp'),
    { type: 'collapse-lane', lane: 'dsp' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default detailBack'),
    { type: 'back-overview' }
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\workflow-diagram.test.js`

Expected: FAIL with `createFlowchartState is not a function`, `transitionFlowchartState is not a function`, or action-shape mismatches because `workflow-diagram.js` still exposes the old single-flow API.

- [ ] **Step 3: Write minimal implementation**

Add a small pure state API to `workflow-diagram.js` before changing the actual Mermaid layout.

```js
const LANE_KEYS = ['imu', 'dsp', 'ble'];

function createFlowchartState(overrides = {}) {
    return {
        mode: overrides.mode === 'detail' ? 'detail' : 'overview',
        openLanes: {
            imu: Boolean(overrides.openLanes?.imu),
            dsp: Boolean(overrides.openLanes?.dsp),
            ble: Boolean(overrides.openLanes?.ble)
        }
    };
}

function transitionFlowchartState(state, action) {
    const current = createFlowchartState(state);

    if (action?.type === 'back-overview') {
        return createFlowchartState();
    }

    if (!LANE_KEYS.includes(action?.lane)) {
        return current;
    }

    if (action.type === 'open-detail') {
        return createFlowchartState({
            mode: 'detail',
            openLanes: {
                imu: action.lane === 'imu',
                dsp: action.lane === 'dsp',
                ble: action.lane === 'ble'
            }
        });
    }

    if (action.type === 'expand-lane') {
        return createFlowchartState({
            mode: 'detail',
            openLanes: {
                ...current.openLanes,
                [action.lane]: true
            }
        });
    }

    if (action.type === 'collapse-lane') {
        return createFlowchartState({
            mode: 'detail',
            openLanes: {
                ...current.openLanes,
                [action.lane]: false
            }
        });
    }

    return current;
}

function getFlowchartActionFromClassName(className) {
    if (hasClassToken(className, 'detailBack')) {
        return { type: 'back-overview' };
    }
    if (hasClassToken(className, 'nodeOverviewImu')) {
        return { type: 'open-detail', lane: 'imu' };
    }
    if (hasClassToken(className, 'nodeOverviewDsp')) {
        return { type: 'open-detail', lane: 'dsp' };
    }
    if (hasClassToken(className, 'nodeOverviewBle')) {
        return { type: 'open-detail', lane: 'ble' };
    }
    if (hasClassToken(className, 'nodeLaneImu')) {
        return { type: 'expand-lane', lane: 'imu' };
    }
    if (hasClassToken(className, 'nodeLaneDsp')) {
        return { type: 'expand-lane', lane: 'dsp' };
    }
    if (hasClassToken(className, 'nodeLaneBle')) {
        return { type: 'expand-lane', lane: 'ble' };
    }
    if (hasClassToken(className, 'laneCloseImu')) {
        return { type: 'collapse-lane', lane: 'imu' };
    }
    if (hasClassToken(className, 'laneCloseDsp')) {
        return { type: 'collapse-lane', lane: 'dsp' };
    }
    if (hasClassToken(className, 'laneCloseBle')) {
        return { type: 'collapse-lane', lane: 'ble' };
    }
    if (hasClassToken(className, 'nodeDspFlow')) {
        return { type: 'navigate', href: 'flow.html' };
    }
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests\workflow-diagram.test.js`

Expected: PASS with no output.

- [ ] **Step 5: Commit**

```bash
git add workflow-diagram.js tests/workflow-diagram.test.js
git commit -m "refactor: add firmware flow view state model"
```

### Task 2: Replace the Mermaid source with overview and detail-board definitions

**Files:**
- Modify: `workflow-diagram.js`
- Modify: `tests/workflow-diagram.test.js`

- [ ] **Step 1: Write the failing test**

Add assertions that lock in the new overview story, the always-present three-lane detail board, lane-level close controls, and the continued DSP navigation node.

```js
const {
    buildMainFlowchartDefinition,
    createFlowchartState
} = require('../workflow-diagram.js');

const overviewDefinition = buildMainFlowchartDefinition(createFlowchartState());
assert.match(overviewDefinition, /graph LR;/);
assert.match(overviewDefinition, /Boot/);
assert.match(overviewDefinition, /BLE advertise/);
assert.match(overviewDefinition, /CSC notifications/);
assert.match(overviewDefinition, /nodeOverviewImu/);
assert.match(overviewDefinition, /nodeOverviewDsp/);
assert.match(overviewDefinition, /nodeOverviewBle/);

const detailDefinition = buildMainFlowchartDefinition(createFlowchartState({
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: true }
}));

assert.match(detailDefinition, /subgraph LANE_IMU/);
assert.match(detailDefinition, /subgraph LANE_DSP/);
assert.match(detailDefinition, /subgraph LANE_BLE/);
assert.match(detailDefinition, /laneCloseImu/);
assert.match(detailDefinition, /laneCloseBle/);
assert.doesNotMatch(detailDefinition, /laneCloseDsp/);
assert.match(detailDefinition, /Sample store/);
assert.match(detailDefinition, /CSC notify/);
assert.match(detailDefinition, /nodeDspFlow/);
assert.doesNotMatch(detailDefinition, /\bdirection TD\b/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\workflow-diagram.test.js`

Expected: FAIL because `buildMainFlowchartDefinition()` still generates the old boot/I2C/sleep graph and does not emit the overview-story classes or the three-lane detail board.

- [ ] **Step 3: Write minimal implementation**

Rebuild `buildMainFlowchartDefinition()` so it accepts the state object and branches between an overview graph and a detail-board graph.

```js
function buildOverviewDefinition() {
    return [
        'graph LR;',
        'Boot([Boot]) --> Adv([BLE advertise]);',
        'Adv --> Link([Client connects]);',
        'Link --> Ntf([CSC notifications enabled]);',
        'Ntf --> Imu([Sensor input]):::nodeOverviewImu;',
        'Imu --> Dsp([Stroke estimate]):::nodeOverviewDsp;',
        'Dsp --> Ble([BLE cadence out]):::nodeOverviewBle;',
        'Ble -. restart .-> Adv;',
        'classDef overviewNode fill:#f3f5f7,stroke:#172b45,stroke-width:2px,color:#122133;',
        'classDef nodeOverviewImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
        'classDef nodeOverviewDsp fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
        'classDef nodeOverviewBle fill:#b8d6c3,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;'
    ].join('\\n');
}

function buildDetailDefinition(state) {
    const { openLanes } = createFlowchartState(state);
    const lines = [
        'graph LR;',
        'Back([Back]):::detailBack;',
        'subgraph LANE_IMU [Sensor / IMU]',
        'direction TB',
        openLanes.imu
            ? 'ImuClose([ - ]):::laneCloseImu; ImuSelect([Compile-time source]); ImuInit([Driver init]); ImuRun([Acquire samples]); ImuPush([Push to sample store]); ImuClose --> ImuSelect --> ImuInit --> ImuRun --> ImuPush;'
            : 'ImuCompact([Sensor input]):::nodeLaneImu;',
        'end',
        'subgraph LANE_DSP [DSP / Stroke Rate]',
        'direction TB',
        openLanes.dsp
            ? 'DspClose([ - ]):::laneCloseDsp; DspStore([Sample store]); DspAuto([Autocorrelation]); DspGuard([Confidence + harmonic guard]); DspKalman([Kalman smoothing]); DspOut([Cadence RPM / Flow Builder]):::nodeDspFlow; DspClose --> DspStore --> DspAuto --> DspGuard --> DspKalman --> DspOut;'
            : 'DspCompact([Stroke estimate]):::nodeLaneDsp;',
        'end',
        'subgraph LANE_BLE [BLE / CSCP]',
        'direction TB',
        openLanes.ble
            ? 'BleClose([ - ]):::laneCloseBle; BleAdv([BLE advertise]); BleConn([Client connects]); BleGate([CSC notifications enabled]); BleStart([pipeline_start()]); BleTick([CSC measurement timer]); BleSend([CSC notify]); BleClose --> BleAdv --> BleConn --> BleGate --> BleStart --> BleTick --> BleSend;'
            : 'BleCompact([BLE cadence out]):::nodeLaneBle;',
        'end',
        'ImuPush -. samples .-> DspStore;',
        'DspOut -. cadence .-> BleTick;',
        'BleSend -. stop/restart .-> BleAdv;'
    ];

    return lines.join('\\n');
}

function buildMainFlowchartDefinition(state) {
    const current = createFlowchartState(state);
    return current.mode === 'detail'
        ? buildDetailDefinition(current)
        : buildOverviewDefinition();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests\workflow-diagram.test.js`

Expected: PASS with no output.

- [ ] **Step 5: Commit**

```bash
git add workflow-diagram.js tests/workflow-diagram.test.js
git commit -m "feat: redesign firmware flow mermaid definitions"
```

### Task 3: Wire the page to the new state model and add a persistent back control

**Files:**
- Modify: `index.html`
- Modify: `script.js`
- Modify: `tests/site-smoke.ps1`

- [ ] **Step 1: Write the failing test**

Extend the smoke test so it asserts the new fixed-frame hooks exist in the markup and the script uses the state-transition API instead of the old `expandedFlow` string.

```powershell
if ($html -notmatch 'id="flowchart-shell"') {
    throw "Expected firmware flow shell container in index.html."
}

if ($html -notmatch 'id="flowchart-back-btn"') {
    throw "Expected firmware flow back button in index.html."
}

if ($js -notmatch 'createFlowchartState' -or $js -notmatch 'transitionFlowchartState') {
    throw "Expected script.js to use the firmware flow state helpers."
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: FAIL because the current markup only has `flowchart-container` and `main-flowchart`, and `script.js` still uses `expandedFlow`.

- [ ] **Step 3: Write minimal implementation**

Replace the inline flowchart wrapper in `index.html` with a stable shell and external back button, then update `script.js` to store the full view state and route click actions through `transitionFlowchartState()`.

```html
<div class="flowchart-shell" id="flowchart-shell">
    <div class="flowchart-toolbar">
        <button
            class="flowchart-back-btn"
            id="flowchart-back-btn"
            type="button"
            hidden
        >
            Back to overview
        </button>
    </div>
    <div class="flowchart-frame" id="flowchart-container">
        <div class="mermaid flowchart-stage" id="main-flowchart"></div>
    </div>
</div>
```

```js
let flowchartState = createFlowchartState();

function syncFlowchartUi() {
    const shell = document.getElementById('flowchart-shell');
    const backBtn = document.getElementById('flowchart-back-btn');
    if (!shell || !backBtn) return;

    shell.classList.toggle('is-detail', flowchartState.mode === 'detail');
    backBtn.hidden = flowchartState.mode !== 'detail';
}

window.renderMainFlowchart = async function() {
    if (typeof buildMainFlowchartDefinition !== 'function') return;
    const container = document.getElementById('main-flowchart');
    if (!container) return;

    syncFlowchartUi();
    container.removeAttribute('data-processed');
    container.innerHTML = buildMainFlowchartDefinition(flowchartState);
    await mermaid.run({ querySelector: '#main-flowchart' });
};

document.getElementById('flowchart-back-btn')?.addEventListener('click', () => {
    flowchartState = transitionFlowchartState(flowchartState, { type: 'back-overview' });
    renderMainFlowchart();
});

document.addEventListener('click', function(e) {
    const flowchartContainer = document.getElementById('flowchart-container');
    if (!flowchartContainer || !flowchartContainer.contains(e.target)) return;

    let target = e.target;
    while (target && target !== document) {
        const action = getFlowchartActionFromClassName?.(target.getAttribute?.('class') || '');
        if (action?.type === 'navigate') {
            window.location.href = action.href;
            return;
        }
        if (action) {
            flowchartState = transitionFlowchartState(flowchartState, action);
            renderMainFlowchart();
            return;
        }
        target = target.parentNode;
    }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: `Static site smoke test passed.`

- [ ] **Step 5: Commit**

```bash
git add index.html script.js tests/site-smoke.ps1
git commit -m "feat: wire firmware flow detail state into page"
```

### Task 4: Give the diagram a fixed footprint and smooth in-place transitions

**Files:**
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `script.js`

- [ ] **Step 1: Write the failing test**

Add static checks to `tests/site-smoke.ps1` that enforce the new class hooks for the fixed frame and transition states.

```powershell
if ($css -notmatch '\.flowchart-shell' -or $css -notmatch '\.flowchart-frame') {
    throw "Expected firmware flow shell/frame styles in styles.css."
}

if ($css -notmatch '\.flowchart-shell\.is-detail' -or $css -notmatch 'transition:') {
    throw "Expected detail-state styling and transitions for the firmware flow."
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: FAIL because the current stylesheet still uses inline flowchart card styling and has no dedicated fixed-frame classes.

- [ ] **Step 3: Write minimal implementation**

Move the flowchart card layout from inline HTML styles into reusable CSS classes and keep the frame height stable across overview and detail states.

```css
.flowchart-shell {
    width: 100%;
    max-width: 980px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.flowchart-toolbar {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    min-height: 2.75rem;
}

.flowchart-back-btn {
    border: 2px solid var(--navy);
    background: #ffffff;
    color: var(--navy);
    box-shadow: var(--hard-shadow-sm);
}

.flowchart-frame {
    width: 100%;
    min-height: 520px;
    padding: 1rem;
    background: var(--mist);
    border: 2px dashed var(--navy);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.flowchart-shell.is-detail .flowchart-frame {
    min-height: 520px;
}

.flowchart-stage {
    width: 100%;
    opacity: 1;
    transform: translateY(0);
    transition: opacity 180ms ease, transform 180ms ease;
}

.flowchart-shell.is-transitioning .flowchart-stage {
    opacity: 0.55;
    transform: translateY(6px);
}
```

In `script.js`, briefly toggle a transition class around re-renders instead of letting the card pop abruptly:

```js
async function rerenderFlowchart() {
    const shell = document.getElementById('flowchart-shell');
    shell?.classList.add('is-transitioning');
    await renderMainFlowchart();
    requestAnimationFrame(() => {
        shell?.classList.remove('is-transitioning');
    });
}
```

Use `rerenderFlowchart()` everywhere the state changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: `Static site smoke test passed.`

- [ ] **Step 5: Commit**

```bash
git add styles.css index.html script.js tests/site-smoke.ps1
git commit -m "style: stabilize firmware flow card layout"
```

### Task 5: Verify the firmware story, interactions, and regression coverage

**Files:**
- Modify: `tests/workflow-diagram.test.js`
- Modify: `tests/site-smoke.ps1`
- Inspect: `index.html`
- Inspect: `script.js`
- Inspect: `workflow-diagram.js`
- Inspect: `styles.css`

- [ ] **Step 1: Add the final regression assertions**

Before the final verification run, make sure `tests/workflow-diagram.test.js` covers the key spec promises in one place:

```js
const allOpenDetail = buildMainFlowchartDefinition(createFlowchartState({
    mode: 'detail',
    openLanes: { imu: true, dsp: true, ble: true }
}));

assert.match(allOpenDetail, /laneCloseImu/);
assert.match(allOpenDetail, /laneCloseDsp/);
assert.match(allOpenDetail, /laneCloseBle/);
assert.match(allOpenDetail, /Sample store/);
assert.match(allOpenDetail, /Autocorrelation/);
assert.match(allOpenDetail, /Kalman smoothing/);
assert.match(allOpenDetail, /pipeline_start\(\)/);
assert.match(allOpenDetail, /CSC notify/);
assert.match(allOpenDetail, /Compile-time source/);
```

- [ ] **Step 2: Run the JavaScript regression test**

Run: `node tests\workflow-diagram.test.js`

Expected: PASS with no output.

- [ ] **Step 3: Run the static smoke test**

Run: `powershell -ExecutionPolicy Bypass -File tests\site-smoke.ps1`

Expected: `Static site smoke test passed.`

- [ ] **Step 4: Run syntax verification**

Run: `node -c workflow-diagram.js`
Expected: exit code `0`

Run: `node -c script.js`
Expected: exit code `0`

- [ ] **Step 5: Perform manual browser verification**

Open the site locally and verify these exact behaviors:

- Overview mode shows the short story: `Boot`, `BLE advertise`, `Client connects`, `CSC notifications enabled`, `Sensor input`, `Stroke estimate`, `BLE cadence out`.
- Clicking `Sensor input` opens detail mode with the IMU lane expanded first.
- Clicking compact DSP and BLE lanes in detail mode opens them too without closing the IMU lane.
- Clicking the small `-` inside one expanded lane collapses only that lane.
- Clicking the global back button returns to the overview.
- The frame height stays visually stable while switching modes.
- The page does not jump vertically when lanes open or close.
- The DSP output action still navigates to `flow.html`.

- [ ] **Step 6: Commit**

```bash
git add tests/workflow-diagram.test.js tests/site-smoke.ps1 workflow-diagram.js script.js styles.css index.html
git commit -m "test: verify redesigned firmware system flow"
```
