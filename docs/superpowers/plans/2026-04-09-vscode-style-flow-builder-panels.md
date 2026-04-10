# VS Code Style Flow Builder Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flow-builder's in-panel `+` / `-` toggles with docked side and bottom panel handles that behave more like VS Code while keeping the shared top bar intact.

**Architecture:** Keep the existing `is-collapsed` panel states for the sidebar and execution console, but move the toggle controls out of the panel headers into dedicated dock buttons anchored to the panel edges. Extract the toggle wiring into a small module so the collapse behavior can be tested without a browser runtime and so `flow.js` only composes the UI instead of owning the toggle logic inline.

**Tech Stack:** Static HTML, shared site CSS, flow-builder CSS, vanilla browser JavaScript, Node `assert` tests.

---

### Task 1: Add a regression test for docked panel toggle behavior

**Files:**
- Create: `flow-builder/tests/panel-docks.test.js`
- Modify: `flow-builder/src/flow.js`
- Modify: `flow-builder/src/panel-docks.js`

- [ ] **Step 1: Write the failing test**

```js
const assert = require('node:assert/strict');
const { bindPanelDocks } = require('../src/panel-docks.js');

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add: value => values.add(value),
        remove: value => values.delete(value),
        toggle(value) {
            if (values.has(value)) {
                values.delete(value);
                return false;
            }
            values.add(value);
            return true;
        },
        contains: value => values.has(value)
    };
}

const sidebar = { classList: createClassList() };
const consolePane = { classList: createClassList() };
const sidebarDock = { textContent: '', setAttribute(name, value) { this[name] = value; } };
const consoleDock = { textContent: '', setAttribute(name, value) { this[name] = value; } };

let updates = 0;
const controls = bindPanelDocks({
    sidebar,
    consolePane,
    sidebarDock,
    consoleDock,
    updateWires: () => { updates += 1; }
});

controls.toggleSidebar();
assert.equal(sidebar.classList.contains('is-collapsed'), true);
assert.match(sidebarDock.textContent, /show/i);

controls.toggleConsole();
assert.equal(consolePane.classList.contains('is-collapsed'), true);
assert.match(consoleDock.textContent, /show/i);
assert.equal(updates, 2);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node flow-builder/tests/panel-docks.test.js`
Expected: FAIL with `Cannot find module '../src/panel-docks.js'` or `bindPanelDocks is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function bindPanelDocks({ sidebar, consolePane, sidebarDock, consoleDock, updateWires }) {
    function syncDock(button, collapsed, showLabel, hideLabel) {
        button.textContent = collapsed ? showLabel : hideLabel;
        button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    function toggleSidebar() {
        const collapsed = sidebar.classList.toggle('is-collapsed');
        syncDock(sidebarDock, collapsed, 'Show sidebar', 'Hide sidebar');
        updateWires();
        return collapsed;
    }

    function toggleConsole() {
        const collapsed = consolePane.classList.toggle('is-collapsed');
        syncDock(consoleDock, collapsed, 'Show outputs', 'Hide outputs');
        updateWires();
        return collapsed;
    }

    syncDock(sidebarDock, sidebar.classList.contains('is-collapsed'), 'Show sidebar', 'Hide sidebar');
    syncDock(consoleDock, consolePane.classList.contains('is-collapsed'), 'Show outputs', 'Hide outputs');

    return { toggleSidebar, toggleConsole };
}

module.exports = { bindPanelDocks };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node flow-builder/tests/panel-docks.test.js`
Expected: PASS with exit code `0`

- [ ] **Step 5: Commit**

```bash
git add flow-builder/tests/panel-docks.test.js flow-builder/src/panel-docks.js flow-builder/src/flow.js
git commit -m "test: cover flow builder panel dock toggles"
```

### Task 2: Move the collapse controls from panel headers to docked panel handles

**Files:**
- Modify: `flow-builder/index.html`
- Modify: `flow-builder/flow.css`
- Modify: `flow-builder/src/flow.js`
- Modify: `flow-builder/src/panel-docks.js`

- [ ] **Step 1: Update the markup to add dock handles and remove header toggle buttons**

```html
<aside class="sidebar" id="dsp-sidebar">
    <button id="sidebar-dock-btn" class="panel-dock panel-dock-sidebar" type="button"></button>
    <div class="sidebar-header">
        <div class="sidebar-header-top">
            <h2 data-i18n="sidebar-title">DSP Pipeline</h2>
        </div>
        <p id="catalog-status" class="status-pill" data-i18n="flow-status-loading">Loading catalog...</p>
    </div>
</aside>

<div class="console-pane bottom-console" id="execution-console">
    <button id="console-dock-btn" class="panel-dock panel-dock-console" type="button"></button>
    <div class="console-header">
        <h3 data-i18n="graph-title">Execution Outputs</h3>
    </div>
</div>
```

- [ ] **Step 2: Style the dock handles so they match the shared menu language**

```css
.panel-dock {
    position: absolute;
    border: 2px solid var(--navy);
    background: #fff;
    color: var(--navy);
    box-shadow: var(--hard-shadow-md);
    font: inherit;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.panel-dock-sidebar {
    top: 1rem;
    right: -2.4rem;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
}

.panel-dock-console {
    top: -2.4rem;
    right: 1rem;
}
```

- [ ] **Step 3: Wire the new dock buttons into the tested toggle module**

```js
const { bindPanelDocks } = require('./panel-docks.js');

const panelDocks = bindPanelDocks({
    sidebar: document.getElementById('dsp-sidebar'),
    consolePane: document.getElementById('execution-console'),
    sidebarDock: document.getElementById('sidebar-dock-btn'),
    consoleDock: document.getElementById('console-dock-btn'),
    updateWires: () => setTimeout(updateWires, 350)
});

document.getElementById('sidebar-dock-btn')?.addEventListener('click', panelDocks.toggleSidebar);
document.getElementById('console-dock-btn')?.addEventListener('click', panelDocks.toggleConsole);
```

- [ ] **Step 4: Run focused tests**

Run:
- `node flow-builder/tests/panel-docks.test.js`
- `node tests/flow-builder-viewmodel.test.js`
- `node tests/flow-graph.test.js`

Expected:
- all commands exit `0`

- [ ] **Step 5: Commit**

```bash
git add flow-builder/index.html flow-builder/flow.css flow-builder/src/flow.js flow-builder/src/panel-docks.js flow-builder/tests/panel-docks.test.js
git commit -m "feat: dock flow builder panels like vscode"
```

### Task 3: Verify the end state and clean up duplicated panel-toggle CSS

**Files:**
- Modify: `flow-builder/flow.css`
- Test: `flow-builder/tests/panel-docks.test.js`
- Test: `tests/flow-builder-viewmodel.test.js`
- Test: `tests/flow-graph.test.js`

- [ ] **Step 1: Remove duplicated toggle CSS blocks and keep one authoritative panel section**

```css
/* Keep one copy of the collapse state and dock styles near the end of flow.css.
   Delete the earlier duplicated .toggle-btn / .sidebar.is-collapsed / .console-header block. */
```

- [ ] **Step 2: Run the focused verification again**

Run:
- `node flow-builder/tests/panel-docks.test.js`
- `node tests/flow-builder-viewmodel.test.js`
- `node tests/flow-graph.test.js`

Expected:
- all commands exit `0`

- [ ] **Step 3: Commit**

```bash
git add flow-builder/flow.css flow-builder/tests/panel-docks.test.js tests/flow-builder-viewmodel.test.js tests/flow-graph.test.js
git commit -m "refactor: clean flow builder panel dock styles"
```
