# Flow Builder Toolbar Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the flow-builder worktree UI to a single-toolbar header, `+` / `-` dock toggles, and smoother sidebar collapse behavior.

**Architecture:** Add a small shared dock-toggle helper for both browser runtime and Node tests, move the worktree page to the docked sidebar plus bottom console layout, and replace snap-hide sidebar rules with animated inner-content transitions. Keep the existing flow runtime ids intact so `flow.js` only needs light integration changes.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node `assert` tests.

---

### Task 1: Update the dock toggle contract for `+` / `-`

**Files:**
- Modify: `flow-builder/tests/panel-docks.test.js`
- Create: `flow-builder/src/panel-docks.js`

- [ ] **Step 1: Make the test assert `+` and `-` instead of directional arrows**
- [ ] **Step 2: Run `node flow-builder/tests/panel-docks.test.js` and confirm it fails because `panel-docks.js` is missing**
- [ ] **Step 3: Implement `flow-builder/src/panel-docks.js` with a shared `bindPanelDocks()` helper**
- [ ] **Step 4: Run `node flow-builder/tests/panel-docks.test.js` and confirm it passes**

### Task 2: Replace the old worktree flow-builder layout with the docked-panel layout

**Files:**
- Modify: `flow-builder/index.html`
- Modify: `flow-builder/src/flow.js`

- [ ] **Step 1: Replace the old sidebar-only tester layout with a sidebar plus bottom console layout**
- [ ] **Step 2: Build one unified toolbar container with `Back to Site` on the left, run/upload/progress/status in the middle, and `EN | FR` on the far right**
- [ ] **Step 3: Include `panel-docks.js` and bind the dock buttons from `flow.js`**
- [ ] **Step 4: Keep existing element ids for runtime output nodes and buttons**

### Task 3: Restyle the header and panel transitions

**Files:**
- Modify: `flow-builder/flow.css`

- [ ] **Step 1: Replace the old sidebar/tester/graph-panel styles with the docked panel styles**
- [ ] **Step 2: Add one unified top toolbar style that matches the shared site language**
- [ ] **Step 3: Animate sidebar collapse using width plus inner-content fade/slide instead of `display: none` snapping**
- [ ] **Step 4: Keep responsive behavior readable on narrow screens**

### Task 4: Verify the worktree implementation

**Files:**
- Test: `flow-builder/tests/panel-docks.test.js`
- Test: `tests/flow-builder-viewmodel.test.js`
- Test: `tests/flow-graph.test.js`
- Test: `flow-builder/tests/flow-compiler.test.js`

- [ ] **Step 1: Run `node flow-builder/tests/panel-docks.test.js`**
- [ ] **Step 2: Run `node tests/flow-builder-viewmodel.test.js`**
- [ ] **Step 3: Run `node tests/flow-graph.test.js`**
- [ ] **Step 4: Run `node flow-builder/tests/flow-compiler.test.js`**
