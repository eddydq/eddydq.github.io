# Flow Builder Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prototype node-based flow builder UI with DOM blocks, SVG wires, drag-and-drop, and port connection logic.

**Architecture:** A static HTML page `flow.html` with an absolute-positioned SVG overlay for wires and a DOM layer for blocks. Blocks are generic, cloned from a sidebar palette, and feature +/- controls to adjust ports on left/right sides. Connection supports both drag-to-connect and click-to-connect.

**Tech Stack:** Vanilla HTML, CSS, JavaScript (no external frameworks).

---

### Task 1: Scaffolding the HTML structure

**Files:**
- Create: `flow.html`
- Create: `flow.css`
- Create: `flow.js`

- [ ] **Step 1: Write the failing test**

There are no formal unit tests for vanilla DOM interactions in this project, so we will use visual verification and a basic sanity check script in tests if needed. For now, the "test" is to ensure the page loads and contains the necessary containers.

- [ ] **Step 2: Write minimal HTML scaffolding**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Builder Prototype</title>
    <link rel="stylesheet" href="flow.css">
</head>
<body>
    <div class="app-container">
        <aside class="sidebar">
            <h2>Palette</h2>
            <div class="palette-block" draggable="true" id="generic-block-template">
                Generic Block
            </div>
        </aside>
        <main class="canvas-container" id="canvas">
            <svg id="wires-layer" class="wires-layer"></svg>
            <div id="blocks-layer" class="blocks-layer"></div>
        </main>
    </div>
    <script src="flow.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write initial CSS layout**

```css
body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: 'Sora', sans-serif;
    overflow: hidden;
}

.app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
}

.sidebar {
    width: 250px;
    background: #f4f4f5;
    border-right: 1px solid #e4e4e7;
    padding: 20px;
    box-sizing: border-box;
    z-index: 10;
}

.canvas-container {
    flex-grow: 1;
    position: relative;
    background: #fafafa;
    overflow: hidden;
}

.wires-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}

.blocks-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: auto;
    z-index: 2;
}

.palette-block {
    background: white;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    cursor: grab;
    user-select: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

- [ ] **Step 4: Commit**

```bash
git add flow.html flow.css flow.js
git commit -m "feat(flow): scaffold flow builder prototype layout"
```

### Task 2: Block Drag and Drop to Canvas

**Files:**
- Modify: `flow.js`
- Modify: `flow.css`

- [ ] **Step 1: Write CSS for canvas blocks and ports**

```css
.canvas-block {
    position: absolute;
    background: white;
    border: 2px solid #3f3f46;
    border-radius: 8px;
    min-width: 120px;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    cursor: grab;
    user-select: none;
}

.canvas-block.active {
    border-color: #2563eb;
}

.block-header {
    background: #f4f4f5;
    padding: 8px;
    border-bottom: 1px solid #e4e4e7;
    border-radius: 6px 6px 0 0;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.block-body {
    display: flex;
    justify-content: space-between;
    flex-grow: 1;
    padding: 10px 0;
    position: relative;
}

.ports-left, .ports-right {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    position: absolute;
    top: 0;
    bottom: 0;
}

.ports-left { left: -6px; }
.ports-right { right: -6px; }

.port {
    width: 12px;
    height: 12px;
    background: #e4e4e7;
    border: 2px solid #3f3f46;
    border-radius: 50%;
    cursor: crosshair;
}

.port:hover, .port.active {
    background: #2563eb;
    border-color: #2563eb;
}

.port-controls {
    display: flex;
    gap: 4px;
}

.port-controls button {
    background: none;
    border: 1px solid #d4d4d8;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    padding: 0 4px;
}
```

- [ ] **Step 2: Write logic for drag-and-drop from palette**

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const paletteBlock = document.getElementById('generic-block-template');
    const canvas = document.getElementById('canvas');
    const blocksLayer = document.getElementById('blocks-layer');
    
    let blockIdCounter = 0;

    paletteBlock.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'new-block');
        e.dataTransfer.effectAllowed = 'copy';
    });

    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if (data === 'new-block') {
            const rect = blocksLayer.getBoundingClientRect();
            const x = e.clientX - rect.left - 60; // center roughly
            const y = e.clientY - rect.top - 40;
            createBlock(x, y);
        }
    });

    function createBlock(x, y) {
        const block = document.createElement('div');
        block.className = 'canvas-block';
        block.style.left = `${x}px`;
        block.style.top = `${y}px`;
        block.id = `block-${blockIdCounter++}`;
        
        block.innerHTML = `
            <div class="block-header">
                Block ${blockIdCounter}
                <div class="port-controls">
                    <button class="add-left">+</button>
                    <button class="add-right">+</button>
                </div>
            </div>
            <div class="block-body">
                <div class="ports-left"></div>
                <div class="ports-right"></div>
            </div>
        `;
        
        blocksLayer.appendChild(block);
        
        // Default: 1 left, 1 right
        addPort(block, 'left');
        addPort(block, 'right');
        
        setupBlockInteractions(block);
    }

    function addPort(block, side) {
        const container = block.querySelector(`.ports-${side}`);
        if (container.children.length >= 3) return; // Max 3 ports
        
        const port = document.createElement('div');
        port.className = 'port';
        port.dataset.blockId = block.id;
        port.dataset.side = side;
        port.dataset.portId = `${block.id}-${side}-${container.children.length}`;
        container.appendChild(port);
        
        setupPortInteractions(port);
    }
    
    // Stubs for setupBlockInteractions and setupPortInteractions
    function setupBlockInteractions(block) {
        block.querySelector('.add-left').addEventListener('click', () => addPort(block, 'left'));
        block.querySelector('.add-right').addEventListener('click', () => addPort(block, 'right'));
    }
    
    function setupPortInteractions(port) {}
});
```

- [ ] **Step 3: Commit**

```bash
git add flow.css flow.js
git commit -m "feat(flow): implement block drag and drop from palette"
```

### Task 3: Block Moving and Port Connections

**Files:**
- Modify: `flow.js`

- [ ] **Step 1: Implement block moving logic**

```javascript
// Add to flow.js setupBlockInteractions
function setupBlockInteractions(block) {
    block.querySelector('.add-left').addEventListener('click', () => addPort(block, 'left'));
    block.querySelector('.add-right').addEventListener('click', () => addPort(block, 'right'));
    
    const header = block.querySelector('.block-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(block.style.left || 0, 10);
        initialTop = parseInt(block.style.top || 0, 10);
        block.classList.add('active');
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        block.style.left = `${initialLeft + dx}px`;
        block.style.top = `${initialTop + dy}px`;
        updateWires();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            block.classList.remove('active');
        }
    });
}
```

- [ ] **Step 2: Implement Wire Logic (SVG and Connection State)**

```javascript
// Add to top of flow.js
let connections = [];
let pendingConnection = null;
const wiresLayer = document.getElementById('wires-layer');
let activeWirePath = null;

// Add to flow.js
function getPortCenter(port) {
    const rect = port.getBoundingClientRect();
    const layerRect = wiresLayer.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2 - layerRect.left,
        y: rect.top + rect.height / 2 - layerRect.top
    };
}

function createWirePath(p1, p2) {
    const dx = Math.abs(p2.x - p1.x) * 0.5;
    return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
}

function updateWires() {
    wiresLayer.innerHTML = '';
    connections.forEach(conn => {
        const sourcePort = document.querySelector(`[data-port-id="${conn.source}"]`);
        const targetPort = document.querySelector(`[data-port-id="${conn.target}"]`);
        if (sourcePort && targetPort) {
            const p1 = getPortCenter(sourcePort);
            const p2 = getPortCenter(targetPort);
            drawWire(p1, p2);
        }
    });
    if (pendingConnection && pendingConnection.currentPos) {
        drawWire(pendingConnection.startPos, pendingConnection.currentPos, true);
    }
}

function drawWire(p1, p2, isTemp = false) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', createWirePath(p1, p2));
    path.setAttribute('stroke', isTemp ? '#9ca3af' : '#2563eb');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    if (isTemp) {
        path.setAttribute('stroke-dasharray', '5,5');
    }
    wiresLayer.appendChild(path);
}
```

- [ ] **Step 3: Implement Port Interactions (Click and Drag)**

```javascript
// Modify setupPortInteractions in flow.js
function setupPortInteractions(port) {
    port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        pendingConnection = {
            source: port.dataset.portId,
            startPos: getPortCenter(port),
            currentPos: getPortCenter(port)
        };
        port.classList.add('active');
    });

    port.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (pendingConnection && pendingConnection.source !== port.dataset.portId) {
            // Complete connection
            connections.push({
                source: pendingConnection.source,
                target: port.dataset.portId
            });
        }
        clearPendingConnection();
        updateWires();
    });
    
    // Support click-to-connect as fallback
    port.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!pendingConnection) {
            pendingConnection = {
                source: port.dataset.portId,
                startPos: getPortCenter(port),
                currentPos: getPortCenter(port)
            };
            port.classList.add('active');
        } else if (pendingConnection.source !== port.dataset.portId) {
            connections.push({
                source: pendingConnection.source,
                target: port.dataset.portId
            });
            clearPendingConnection();
            updateWires();
        }
    });
}

// Add global mouse events for wire dragging
document.addEventListener('mousemove', (e) => {
    // ... block moving logic ...
    
    if (pendingConnection) {
        const layerRect = wiresLayer.getBoundingClientRect();
        pendingConnection.currentPos = {
            x: e.clientX - layerRect.left,
            y: e.clientY - layerRect.top
        };
        updateWires();
    }
});

document.addEventListener('mouseup', () => {
    // ... block moving logic ...
    
    if (pendingConnection) {
        // Drop wire in nowhere
        clearPendingConnection();
        updateWires();
    }
});

function clearPendingConnection() {
    pendingConnection = null;
    document.querySelectorAll('.port').forEach(p => p.classList.remove('active'));
}
```

- [ ] **Step 4: Commit**

```bash
git add flow.js
git commit -m "feat(flow): implement block moving, SVG wires, and port connections"
```
