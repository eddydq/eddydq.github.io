document.addEventListener('DOMContentLoaded', () => {
    console.log("Flow Builder script loaded!");
    
    const paletteBlocks = document.querySelectorAll('.palette-block');
    const canvas = document.getElementById('canvas');
    const blocksLayer = document.getElementById('blocks-layer');
    const wiresLayer = document.getElementById('wires-layer');
    const runBtn = document.getElementById('run-sim-btn');
    const outputGraph = document.getElementById('output-graph');
    
    if (!canvas || !blocksLayer || !wiresLayer || !runBtn || !outputGraph) {
        console.error("Missing required DOM elements!");
        return;
    }

    let blockIdCounter = 0;
    let connections = [];
    let pendingConnection = null;

    // --- Drag and Drop from Palette ---
    paletteBlocks.forEach(block => {
        block.addEventListener('dragstart', (e) => {
            const dragData = JSON.stringify({
                type: block.dataset.type || 'generic',
                name: block.innerText || 'Block'
            });
            try {
                e.dataTransfer.setData('application/json', dragData);
                e.dataTransfer.setData('text/plain', dragData);
            } catch (err) {
                e.dataTransfer.setData('text', dragData);
            }
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        let data = null;
        try {
            const textData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
            data = JSON.parse(textData);
        } catch (err) {
            console.error("Failed to parse dropped data", err);
            return;
        }
        
        if (data && data.type && data.name) {
            const rect = blocksLayer.getBoundingClientRect();
            const x = e.clientX - rect.left - 80;
            const y = e.clientY - rect.top - 40;
            createBlock(x, y, data.name, data.type);
        }
    });

    // --- Block Creation ---
    function createBlock(x, y, name, type) {
        const block = document.createElement('div');
        block.className = 'canvas-block';
        block.style.left = `${x}px`;
        block.style.top = `${y}px`;
        block.id = `block-${blockIdCounter++}`;
        block.dataset.type = type;
        
        let innerContent = '';
        if (type === 'imu') {
            innerContent = `
                <select class="block-select"><option>LIS3DH</option><option>MPU6050</option><option>Polar Verity</option></select>
                <select class="block-select"><option>X-Axis</option><option>Y-Axis</option><option>Z-Axis</option></select>
            `;
        } else if (type === 'filter') {
            innerContent = `
                <select class="block-select"><option>Butterworth LP</option><option>Chebyshev LP</option></select>
                <input type="number" class="block-input" value="5" title="Cutoff Freq (Hz)">
            `;
        } else if (type === 'harmonic') {
            innerContent = `
                <select class="block-select"><option>Moderate</option><option>Aggressive</option></select>
            `;
        } else if (type === 'autocorr') {
            innerContent = `
                <input type="number" class="block-input" value="1024" title="Window Size">
            `;
        } else if (type === 'kalman') {
            innerContent = `
                <input type="text" class="block-input" value="Q=0.01" title="Process Noise">
                <input type="text" class="block-input" value="R=0.1" title="Measurement Noise">
            `;
        } else if (type === 'output') {
            innerContent = `
                <select class="block-select"><option>BLE 0x1816</option><option>UART Console</option></select>
            `;
        }

        block.innerHTML = `
            <div class="block-header">
                <span>${name}</span>
                <button class="delete-btn" title="Delete block">✕</button>
            </div>
            <div class="block-body">
                <div class="port-column">
                    <div class="ports-left"></div>
                    <div class="port-controls">
                        <button class="add-left" title="Add input port">+</button>
                        <button class="remove-left" title="Remove input port">-</button>
                    </div>
                </div>
                <div class="block-content">
                    ${innerContent}
                </div>
                <div class="port-column" style="align-items: flex-end;">
                    <div class="ports-right"></div>
                    <div class="port-controls">
                        <button class="add-right" title="Add output port">+</button>
                        <button class="remove-right" title="Remove output port">-</button>
                    </div>
                </div>
            </div>
        `;
        
        blocksLayer.appendChild(block);
        
        // Defaults based on type
        if (type === 'imu') {
            addPort(block, 'right');
        } else if (type === 'output') {
            addPort(block, 'left');
        } else {
            addPort(block, 'left');
            addPort(block, 'right');
        }
        
        setupBlockInteractions(block);
    }

    // --- Port Management ---
    function addPort(block, side) {
        const container = block.querySelector(`.ports-${side}`);
        if (container.children.length >= 3) return; // Max 3 ports
        
        const port = document.createElement('div');
        port.className = 'port';
        port.dataset.blockId = block.id;
        port.dataset.side = side;
        port.dataset.portId = `${block.id}-${side}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        container.appendChild(port);
        
        setupPortInteractions(port);
        updateWires();
    }

    function removePort(block, side) {
        const container = block.querySelector(`.ports-${side}`);
        if (container.children.length <= 0) return;
        
        const portToRemove = container.lastElementChild;
        if (portToRemove) {
            const portId = portToRemove.dataset.portId;
            connections = connections.filter(conn => conn.source !== portId && conn.target !== portId);
            if (pendingConnection && pendingConnection.source === portId) {
                clearPendingConnection();
            }
            container.removeChild(portToRemove);
            updateWires();
        }
    }

    function setupBlockInteractions(block) {
        block.querySelector('.add-left').addEventListener('click', () => addPort(block, 'left'));
        block.querySelector('.remove-left').addEventListener('click', () => removePort(block, 'left'));
        block.querySelector('.add-right').addEventListener('click', () => addPort(block, 'right'));
        block.querySelector('.remove-right').addEventListener('click', () => removePort(block, 'right'));
        block.querySelector('.delete-btn').addEventListener('click', () => {
            const blockPorts = Array.from(block.querySelectorAll('.port')).map(p => p.dataset.portId);
            connections = connections.filter(conn => !blockPorts.includes(conn.source) && !blockPorts.includes(conn.target));
            if (pendingConnection && blockPorts.includes(pendingConnection.source)) {
                clearPendingConnection();
            }
            block.remove();
            updateWires();
        });
        
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
            blocksLayer.appendChild(block); // bring to front
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

    // --- Wire Logic ---
    function getPortCenter(port) {
        const rect = port.getBoundingClientRect();
        const layerRect = wiresLayer.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - layerRect.left,
            y: rect.top + rect.height / 2 - layerRect.top
        };
    }

    function createWirePath(p1, p2) {
        const dx = Math.max(Math.abs(p2.x - p1.x) * 0.5, 40);
        return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    }

    function drawWire(p1, p2, isTemp = false) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createWirePath(p1, p2));
        path.setAttribute('stroke', isTemp ? '#c7cdd4' : '#172b45');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        if (isTemp) {
            path.setAttribute('stroke-dasharray', '5,5');
            path.style.pointerEvents = 'none';
        }
        wiresLayer.appendChild(path);
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

    // --- Port Interactions (Connections) ---
    function setupPortInteractions(port) {
        // Drag to connect
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
                const sourcePort = document.querySelector(`[data-port-id="${pendingConnection.source}"]`);
                if (sourcePort && sourcePort.dataset.side !== port.dataset.side) {
                    const isSourceRight = sourcePort.dataset.side === 'right';
                    const srcId = isSourceRight ? pendingConnection.source : port.dataset.portId;
                    const tgtId = isSourceRight ? port.dataset.portId : pendingConnection.source;
                    
                    // Remove any existing connections from/to these specific ports
                    connections = connections.filter(c => c.source !== srcId && c.target !== srcId && c.source !== tgtId && c.target !== tgtId);
                    
                    connections.push({
                        source: srcId,
                        target: tgtId
                    });
                }
            }
            clearPendingConnection();
            updateWires();
        });
        
        // Click to connect
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
                const sourcePort = document.querySelector(`[data-port-id="${pendingConnection.source}"]`);
                if (sourcePort && sourcePort.dataset.side !== port.dataset.side) {
                    const isSourceRight = sourcePort.dataset.side === 'right';
                    const srcId = isSourceRight ? pendingConnection.source : port.dataset.portId;
                    const tgtId = isSourceRight ? port.dataset.portId : pendingConnection.source;
                    
                    // Remove any existing connections from/to these specific ports
                    connections = connections.filter(c => c.source !== srcId && c.target !== srcId && c.source !== tgtId && c.target !== tgtId);
                    
                    connections.push({
                        source: srcId,
                        target: tgtId
                    });
                }
                clearPendingConnection();
                updateWires();
            } else {
                clearPendingConnection();
                updateWires();
            }
        });
    }

    document.addEventListener('mousemove', (e) => {
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
        if (pendingConnection) {
            clearPendingConnection();
            updateWires();
        }
    });

    function clearPendingConnection() {
        pendingConnection = null;
        document.querySelectorAll('.port').forEach(p => p.classList.remove('active'));
    }

    // --- Run Simulation Graph ---
    function drawInitialGraph() {
        const ctx = outputGraph.getContext('2d');
        ctx.fillStyle = '#52616d';
        ctx.font = '12px Sora';
        ctx.fillText('Run simulation to view.', 10, outputGraph.height / 2);
    }

    drawInitialGraph();

    runBtn.addEventListener('click', () => {
        const ctx = outputGraph.getContext('2d');
        const width = outputGraph.width;
        const height = outputGraph.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Check if any blocks exist
        if (blocksLayer.children.length === 0) {
            ctx.fillStyle = '#172b45';
            ctx.font = '12px Sora';
            ctx.fillText('No algorithm connected.', 10, height / 2);
            return;
        }

        // Draw fake stroke rate graph (a somewhat noisy but stable line around 35-40 spm)
        ctx.beginPath();
        ctx.strokeStyle = '#4f8ea8'; // water-strong
        ctx.lineWidth = 3;
        
        let y = height / 2;
        ctx.moveTo(0, y);
        
        // Simulate drawing a line chart
        for (let x = 0; x <= width; x += 5) {
            // Add some noise and wave
            y = (height / 2) + Math.sin(x / 10) * 10 + (Math.random() * 10 - 5);
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw points
        ctx.beginPath();
        ctx.fillStyle = '#172b45'; // navy
        for (let x = 0; x <= width; x += 20) {
            y = (height / 2) + Math.sin(x / 10) * 10; // smoother points
            ctx.moveTo(x, y);
            ctx.arc(x, y, 3, 0, Math.PI * 2);
        }
        ctx.fill();
    });
});