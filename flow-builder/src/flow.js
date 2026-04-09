document.addEventListener('DOMContentLoaded', async () => {
    const STORAGE_KEY = 'flow-builder-state-v3';
    const FINAL_OUTPUT_BINDING = 'final';
    const paletteRoot = document.getElementById('palette-groups');
    const blocksLayer = document.getElementById('blocks-layer');
    const wiresLayer = document.getElementById('wires-layer');
    const outputNode = document.getElementById('graph-output-list');
    const diagnosticsNode = document.getElementById('runtime-diagnostics');
    const statusNode = document.getElementById('catalog-status');
    const runButton = document.getElementById('run-sim-btn');
    const uploadButton = document.getElementById('upload-pipeline-btn');
    const uploadProgress = document.getElementById('upload-progress');
    const uploadStatus = document.getElementById('upload-status');
    const canvas = document.getElementById('canvas');

    if (!paletteRoot || !blocksLayer || !wiresLayer || !outputNode || !diagnosticsNode || !statusNode || !runButton || !canvas) {
        return;
    }

    let catalog = null;
    let graph = FlowGraph.createGraphState(loadStoredGraph());
    let runtime = null;
    let pendingConnection = null;
    let dragState = null;
    let lastRunResult = null;
    let suppressSocketClick = false;
    let canvasDropBound = false;

    function translate(key, fallback) {
        if (typeof translations !== 'undefined') {
            const lang = typeof currentLanguage === 'string' ? currentLanguage : 'en';
            return translations[lang]?.[key] || translations.en?.[key] || fallback;
        }

        return fallback;
    }

    function setStatus(key, fallback) {
        statusNode.dataset.i18n = key;
        statusNode.textContent = translate(key, fallback);
    }

    function setUploadStatus(message) {
        if (uploadStatus) {
            uploadStatus.textContent = message;
        }
    }

    function getRuntime() {
        if (!runtime) {
            runtime = FlowRuntimeClient.createFlowRuntimeClient();
        }

        return runtime;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function loadStoredGraph() {
        try {
            if (!globalThis.localStorage) {
                return {};
            }

            const raw = globalThis.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            void error;
            return {};
        }
    }

    function persistGraph() {
        try {
            if (globalThis.localStorage) {
                globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(FlowGraph.serializeGraph(graph)));
            }
        } catch (error) {
            void error;
        }
    }

    function ensureGraphUi() {
        if (!graph.ui || typeof graph.ui !== 'object') {
            graph.ui = {};
        }

        if (!graph.ui.system_nodes || typeof graph.ui.system_nodes !== 'object') {
            graph.ui.system_nodes = {};
        }

        if (!graph.ui.output_bindings || typeof graph.ui.output_bindings !== 'object') {
            graph.ui.output_bindings = {};
        }

        if (!graph.ui.system_input_slots || typeof graph.ui.system_input_slots !== 'object') {
            graph.ui.system_input_slots = {};
        }
    }

    function getSystemInputs() {
        if (catalog && catalog.systemInputs && typeof catalog.systemInputs === 'object') {
            return catalog.systemInputs;
        }

        if (catalog && catalog.system_inputs && typeof catalog.system_inputs === 'object') {
            return catalog.system_inputs;
        }

        return { raw: 'raw_window' };
    }

    function buildDemoInputs() {
        const sampleCount = 64;
        const x = new Array(sampleCount).fill(0);
        const z = new Array(sampleCount).fill(0);
        const y = Array.from({ length: sampleCount }, (_, index) => ((index % 26) < 13 ? 1 : -1));

        return [
            {
                binding_name: 'raw',
                packet: {
                    kind: 'raw_window',
                    data: {
                        sample_rate_hz: 52,
                        length: sampleCount,
                        x,
                        y,
                        z
                    }
                }
            }
        ];
    }

    function parseDefaultValue(param) {
        if (!param || !Object.prototype.hasOwnProperty.call(param, 'default')) {
            return null;
        }

        return param.default;
    }

    function findBlock(blockId) {
        return catalog && catalog.byId ? catalog.byId[blockId] : null;
    }

    function findNode(nodeId) {
        return graph.nodes.find(node => node.node_id === nodeId) || null;
    }

    function getCanvasBounds() {
        return {
            width: Math.max(canvas.clientWidth || 0, 640),
            height: Math.max(canvas.clientHeight || 0, 420)
        };
    }

    function clampPosition(position, dimensions = {}) {
        const bounds = getCanvasBounds();
        const width = Number.isFinite(dimensions.width) ? dimensions.width : 260;
        const height = Number.isFinite(dimensions.height) ? dimensions.height : 180;
        const padding = 24;

        return {
            x: Math.min(Math.max(position.x, padding), Math.max(padding, bounds.width - width - padding)),
            y: Math.min(Math.max(position.y, padding), Math.max(padding, bounds.height - height - padding))
        };
    }

    function getSystemNodePosition(kind) {
        ensureGraphUi();

        const stored = graph.ui.system_nodes[kind];
        if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
            return stored;
        }

        if (kind === 'input') {
            return { x: 36, y: 120 };
        }

        return clampPosition({ x: getCanvasBounds().width - 240, y: 220 }, { width: 200, height: 120 });
    }

    function setSystemNodePosition(kind, position) {
        ensureGraphUi();
        graph.ui.system_nodes[kind] = clampPosition(position, { width: 200, height: 120 });
    }

    function nextNodeId() {
        const maxId = graph.nodes.reduce((currentMax, node) => {
            const match = /^n(\d+)$/.exec(String(node.node_id || ''));
            return match ? Math.max(currentMax, Number(match[1])) : currentMax;
        }, 0);

        return `n${maxId + 1}`;
    }

    function getDefaultNodePosition() {
        return clampPosition({
            x: 240 + (graph.nodes.length * 220),
            y: 120 + ((graph.nodes.length % 3) * 110)
        });
    }

    function createNodeUi(block, position) {
        const inputSlots = {};
        const outputSlots = {};

        for (const input of block.inputs || []) {
            if (input.cardinality === 'many') {
                inputSlots[input.name] = 1;
            }
        }

        for (const output of block.outputs || []) {
            outputSlots[output.name] = 1;
        }

        return {
            position: clampPosition(position || getDefaultNodePosition()),
            input_slots: inputSlots,
            output_slots: outputSlots
        };
    }

    function markGraphDirty() {
        lastRunResult = null;
        persistGraph();
        render();
    }

    function addNode(blockId, position) {
        const block = findBlock(blockId);
        if (!block) {
            return;
        }

        const params = {};
        for (const param of block.params || []) {
            params[param.name] = parseDefaultValue(param);
        }

        graph.nodes.push({
            node_id: nextNodeId(),
            block_id: block.block_id,
            params,
            ui: createNodeUi(block, position)
        });

        markGraphDirty();
    }

    function removeNode(nodeId) {
        graph.nodes = graph.nodes.filter(node => node.node_id !== nodeId);
        graph.connections = graph.connections.filter(connection => (
            !connection.source.startsWith(`${nodeId}.`) &&
            !connection.target.startsWith(`${nodeId}.`)
        ));

        for (const [binding, sourceRef] of Object.entries(graph.outputs || {})) {
            if (String(sourceRef).startsWith(`${nodeId}.`)) {
                delete graph.outputs[binding];
                if (graph.ui && graph.ui.output_bindings) {
                    delete graph.ui.output_bindings[binding];
                }
            }
        }

        markGraphDirty();
    }

    function getBlockPort(block, side, portName) {
        const ports = side === 'input' ? (block.inputs || []) : (block.outputs || []);
        return ports.find(port => port.name === portName) || null;
    }

    function setNodeSlotCount(nodeId, side, portName, nextCount) {
        const node = findNode(nodeId);
        const block = node ? findBlock(node.block_id) : null;
        const port = block ? getBlockPort(block, side, portName) : null;

        if (!node || !block || !port) {
            return;
        }

        if (!node.ui || typeof node.ui !== 'object') {
            node.ui = {};
        }

        const bucketName = side === 'input' ? 'input_slots' : 'output_slots';
        if (!node.ui[bucketName] || typeof node.ui[bucketName] !== 'object') {
            node.ui[bucketName] = {};
        }

        const clampedCount = port.cardinality === 'one' && side === 'input'
            ? 1
            : Math.max(1, nextCount);

        node.ui[bucketName][portName] = clampedCount;

        if (side === 'input') {
            graph.connections = graph.connections.filter(connection => (
                connection.target !== `${nodeId}.${portName}` ||
                !Number.isInteger(connection.target_socket) ||
                connection.target_socket < clampedCount
            ));
        } else {
            graph.connections = graph.connections.filter(connection => (
                connection.source !== `${nodeId}.${portName}` ||
                !Number.isInteger(connection.source_socket) ||
                connection.source_socket < clampedCount
            ));

            for (const [binding, sourceRef] of Object.entries(graph.outputs || {})) {
                const bindingMeta = graph.ui && graph.ui.output_bindings
                    ? graph.ui.output_bindings[binding]
                    : null;

                if (sourceRef === `${nodeId}.${portName}` &&
                    bindingMeta &&
                    Number.isInteger(bindingMeta.source_socket) &&
                    bindingMeta.source_socket >= clampedCount) {
                    delete graph.outputs[binding];
                    delete graph.ui.output_bindings[binding];
                }
            }
        }

        markGraphDirty();
    }

    function getSystemInputSlotCount(binding) {
        ensureGraphUi();

        const stored = graph.ui.system_input_slots[binding];
        const actualCount = graph.connections
            .filter(connection => connection.source === `input.${binding}`)
            .reduce((maxValue, connection) => {
                if (Number.isInteger(connection.source_socket) && connection.source_socket >= 0) {
                    return Math.max(maxValue, connection.source_socket + 1);
                }

                return maxValue + 1;
            }, 0);

        return Math.max(1, Number.isInteger(stored) ? stored : 0, actualCount);
    }

    function setSystemInputSlotCount(binding, nextCount) {
        ensureGraphUi();
        const clampedCount = Math.max(1, nextCount);

        graph.ui.system_input_slots[binding] = clampedCount;
        graph.connections = graph.connections.filter(connection => (
            connection.source !== `input.${binding}` ||
            !Number.isInteger(connection.source_socket) ||
            connection.source_socket < clampedCount
        ));

        markGraphDirty();
    }

    function parseNumeric(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function updateParam(nodeId, paramName, rawValue) {
        const node = findNode(nodeId);
        const block = node ? findBlock(node.block_id) : null;
        const param = block && Array.isArray(block.params)
            ? block.params.find(entry => entry.name === paramName)
            : null;

        if (!node || !param) {
            return;
        }

        if (param.type === 'int') {
            node.params[paramName] = Math.round(parseNumeric(rawValue, parseDefaultValue(param) || 0));
        } else if (param.type === 'float') {
            node.params[paramName] = parseNumeric(rawValue, parseDefaultValue(param) || 0);
        } else {
            node.params[paramName] = rawValue;
        }

        markGraphDirty();
    }

    function getSocketCenter(socket) {
        const rect = socket.getBoundingClientRect();
        const layerRect = wiresLayer.getBoundingClientRect();

        return {
            x: rect.left + (rect.width / 2) - layerRect.left,
            y: rect.top + (rect.height / 2) - layerRect.top
        };
    }

    function readSocketDescriptor(element) {
        return {
            element,
            side: element.dataset.portSide,
            ref: element.dataset.ref,
            socketIndex: Number(element.dataset.socketIndex || 0),
            kind: element.dataset.kind || null,
            acceptKinds: (element.dataset.acceptKinds || '*').split(',').filter(Boolean),
            binding: element.dataset.binding || null
        };
    }

    function clearPendingConnection() {
        pendingConnection = null;
        blocksLayer.querySelectorAll('.port.active').forEach(port => port.classList.remove('active'));
        updateWires();
    }

    function startPendingConnection(element, mode) {
        const descriptor = readSocketDescriptor(element);

        pendingConnection = {
            ...descriptor,
            mode,
            startPos: getSocketCenter(element),
            currentPos: getSocketCenter(element)
        };

        blocksLayer.querySelectorAll('.port.active').forEach(port => port.classList.remove('active'));
        element.classList.add('active');
        updateWires();
    }

    function removeExistingConnectionForOutputSocket(ref, socketIndex) {
        graph.connections = graph.connections.filter(connection => (
            connection.source !== ref ||
            Number(connection.source_socket || 0) !== socketIndex
        ));

        for (const [binding, sourceRef] of Object.entries(graph.outputs || {})) {
            const bindingMeta = graph.ui && graph.ui.output_bindings
                ? graph.ui.output_bindings[binding]
                : null;

            if (sourceRef === ref &&
                bindingMeta &&
                Number(bindingMeta.source_socket || 0) === socketIndex) {
                delete graph.outputs[binding];
                delete graph.ui.output_bindings[binding];
            }
        }
    }

    function removeExistingConnectionForInputSocket(ref, socketIndex) {
        graph.connections = graph.connections.filter(connection => (
            connection.target !== ref ||
            Number(connection.target_socket || 0) !== socketIndex
        ));
    }

    function resolveSocketPair(first, second) {
        if (!first || !second || first.element === second.element || first.side === second.side) {
            return null;
        }

        const output = first.side === 'output' ? first : second;
        const input = first.side === 'input' ? first : second;
        const acceptsAnyKind = input.acceptKinds.includes('*');

        if (!acceptsAnyKind && output.kind && !input.acceptKinds.includes(output.kind)) {
            return { error: `packet kind mismatch: ${output.ref} -> ${input.ref}` };
        }

        return { output, input };
    }

    function connectSockets(first, second) {
        const pair = resolveSocketPair(first, second);

        if (!pair) {
            return false;
        }

        if (pair.error) {
            diagnosticsNode.textContent = JSON.stringify({ error: pair.error }, null, 2);
            setStatus('flow-run-invalid', 'Fix graph validation errors before running.');
            return true;
        }

        removeExistingConnectionForOutputSocket(pair.output.ref, pair.output.socketIndex);

        if (pair.input.binding) {
            ensureGraphUi();
            graph.outputs[pair.input.binding] = pair.output.ref;
            graph.ui.output_bindings[pair.input.binding] = { source_socket: pair.output.socketIndex };
        } else {
            removeExistingConnectionForInputSocket(pair.input.ref, pair.input.socketIndex);
            graph.connections.push({
                source: pair.output.ref,
                source_socket: pair.output.socketIndex,
                target: pair.input.ref,
                target_socket: pair.input.socketIndex
            });
        }

        markGraphDirty();
        return true;
    }

    function suppressNextSocketClick() {
        suppressSocketClick = true;
        setTimeout(() => {
            suppressSocketClick = false;
        }, 0);
    }

    function findSocketElement(side, ref, socketIndex) {
        const ports = blocksLayer.querySelectorAll(`.port[data-port-side="${side}"]`);

        for (const port of ports) {
            if (port.dataset.ref === ref && Number(port.dataset.socketIndex || 0) === socketIndex) {
                return port;
            }
        }

        return null;
    }

    function createWirePath(p1, p2) {
        const dx = Math.max(Math.abs(p2.x - p1.x) * 0.45, 42);
        const dy = (p2.y - p1.y) * 0.12;

        return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y + dy}, ${p2.x - dx} ${p2.y - dy}, ${p2.x} ${p2.y}`;
    }

    function drawWire(p1, p2, options = {}) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const color = options.color || '#172b45';

        path.setAttribute('d', createWirePath(p1, p2));
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', options.width || '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');

        if (options.temporary) {
            path.setAttribute('stroke-dasharray', '8 6');
            path.classList.add('wire-path-temp');
        } else {
            path.classList.add('wire-path');
        }

        wiresLayer.appendChild(path);
    }

    function updateWires() {
        wiresLayer.innerHTML = '';

        for (const connection of graph.connections) {
            const sourceSocket = findSocketElement(
                'output',
                connection.source,
                Number(connection.source_socket || 0)
            );
            const targetSocket = findSocketElement(
                'input',
                connection.target,
                Number(connection.target_socket || 0)
            );

            if (sourceSocket && targetSocket) {
                drawWire(getSocketCenter(sourceSocket), getSocketCenter(targetSocket));
            }
        }

        for (const [binding, sourceRef] of Object.entries(graph.outputs || {})) {
            const bindingMeta = graph.ui && graph.ui.output_bindings
                ? graph.ui.output_bindings[binding]
                : null;
            const sourceSocket = findSocketElement(
                'output',
                sourceRef,
                bindingMeta && Number.isInteger(bindingMeta.source_socket) ? bindingMeta.source_socket : 0
            );
            const targetSocket = findSocketElement('input', `output.${binding}`, 0);

            if (sourceSocket && targetSocket) {
                drawWire(getSocketCenter(sourceSocket), getSocketCenter(targetSocket), { color: '#52616d' });
            }
        }

        if (pendingConnection) {
            drawWire(pendingConnection.startPos, pendingConnection.currentPos, { temporary: true, color: '#7caec2' });
        }
    }

    function renderParamControls(card, block) {
        if (!Array.isArray(block.params) || block.params.length === 0) {
            return '<div class="param-empty">default</div>';
        }

        return block.params.map(param => {
            const value = Object.prototype.hasOwnProperty.call(card.params || {}, param.name)
                ? card.params[param.name]
                : parseDefaultValue(param);

            if (param.type === 'enum' && Array.isArray(param.enum_values)) {
                return `
                    <label class="param-field">
                        <span>${escapeHtml(param.name)}</span>
                        <select
                            class="block-select"
                            data-node-id="${escapeHtml(card.node_id)}"
                            data-param-name="${escapeHtml(param.name)}"
                        >
                            ${param.enum_values.map(option => `
                                <option value="${escapeHtml(option)}" ${String(value) === String(option) ? 'selected' : ''}>
                                    ${escapeHtml(option)}
                                </option>
                            `).join('')}
                        </select>
                    </label>
                `;
            }

            return `
                <label class="param-field">
                    <span>${escapeHtml(param.name)}</span>
                    <input
                        class="block-input"
                        type="number"
                        step="${param.type === 'int' ? '1' : 'any'}"
                        value="${escapeHtml(value)}"
                        data-node-id="${escapeHtml(card.node_id)}"
                        data-param-name="${escapeHtml(param.name)}"
                    >
                </label>
            `;
        }).join('');
    }

    function renderInputPortGroups(nodeId, inputPorts) {
        return inputPorts.map(port => `
            <div class="port-group port-group-input">
                <div class="port-group-label">${escapeHtml(port.name)}</div>
                <div class="ports-stack ports-stack-input">
                    ${port.slots.map(slot => `
                        <button
                            type="button"
                            class="port ${slot.colorClass} ${slot.isConnected ? 'is-connected' : ''} ${slot.acceptsActiveConnection ? 'is-compatible' : ''}"
                            data-port-side="input"
                            data-node-id="${escapeHtml(nodeId)}"
                            data-ref="${escapeHtml(slot.targetRef)}"
                            data-port-name="${escapeHtml(port.name)}"
                            data-socket-index="${slot.slotIndex}"
                            data-accept-kinds="${escapeHtml((port.kinds || []).join(','))}"
                            title="${escapeHtml(port.name)}"
                        ></button>
                    `).join('')}
                </div>
                ${port.canAddSlot ? `
                    <div class="port-controls">
                        <button type="button" data-slot-control="add-input" data-node-id="${escapeHtml(nodeId)}" data-port-name="${escapeHtml(port.name)}">+</button>
                        <button type="button" data-slot-control="remove-input" data-node-id="${escapeHtml(nodeId)}" data-port-name="${escapeHtml(port.name)}">-</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    function renderOutputPortGroups(nodeId, outputPorts) {
        return outputPorts.map(port => `
            <div class="port-group port-group-output">
                <div class="port-group-label">${escapeHtml(port.name)}</div>
                <div class="ports-stack ports-stack-output">
                    ${port.slots.map(slot => `
                        <button
                            type="button"
                            class="port ${slot.colorClass} ${slot.isConnected ? 'is-connected' : ''} ${slot.isActiveSource ? 'active' : ''}"
                            data-port-side="output"
                            data-node-id="${escapeHtml(nodeId)}"
                            data-ref="${escapeHtml(slot.sourceRef)}"
                            data-port-name="${escapeHtml(port.name)}"
                            data-socket-index="${slot.slotIndex}"
                            data-kind="${escapeHtml(port.kind)}"
                            title="${escapeHtml(port.name)}"
                        ></button>
                    `).join('')}
                </div>
                <div class="port-controls">
                    <button type="button" data-slot-control="add-output" data-node-id="${escapeHtml(nodeId)}" data-port-name="${escapeHtml(port.name)}">+</button>
                    <button type="button" data-slot-control="remove-output" data-node-id="${escapeHtml(nodeId)}" data-port-name="${escapeHtml(port.name)}">-</button>
                </div>
            </div>
        `).join('');
    }

    function renderSystemInputBlock() {
        const position = getSystemNodePosition('input');
        const systemInputs = Object.entries(getSystemInputs());

        return `
            <article
                class="canvas-block system-block"
                data-system-node="input"
                style="left:${position.x}px; top:${position.y}px;"
            >
                <div class="block-header" data-drag-kind="system" data-system-kind="input">
                    <span>System Input</span>
                </div>
                <div class="block-body">
                    <div class="block-content system-block-content">
                        <p>External packets</p>
                    </div>
                    <div class="port-side port-side-right">
                        ${systemInputs.map(([binding, kind]) => {
                            const slotCount = getSystemInputSlotCount(binding);

                            return `
                                <div class="port-group port-group-output">
                                    <div class="port-group-label">${escapeHtml(binding)}</div>
                                    <div class="ports-stack ports-stack-output">
                                        ${Array.from({ length: slotCount }, (_, slotIndex) => `
                                            <button
                                                type="button"
                                                class="port ${FlowGraph.PACKET_KIND_COLORS[kind] || 'port-kind-default'}"
                                                data-port-side="output"
                                                data-ref="input.${escapeHtml(binding)}"
                                                data-port-name="${escapeHtml(binding)}"
                                                data-socket-index="${slotIndex}"
                                                data-kind="${escapeHtml(kind)}"
                                                title="${escapeHtml(binding)}"
                                            ></button>
                                        `).join('')}
                                    </div>
                                    <div class="port-controls">
                                        <button type="button" data-slot-control="add-system-output" data-binding="${escapeHtml(binding)}">+</button>
                                        <button type="button" data-slot-control="remove-system-output" data-binding="${escapeHtml(binding)}">-</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </article>
        `;
    }

    function renderSystemOutputBlock() {
        const position = getSystemNodePosition('output');

        return `
            <article
                class="canvas-block system-block system-block-output"
                data-system-node="output"
                style="left:${position.x}px; top:${position.y}px;"
            >
                <div class="block-header" data-drag-kind="system" data-system-kind="output">
                    <span>Final Output</span>
                </div>
                <div class="block-body">
                    <div class="port-side port-side-left">
                        <div class="port-group port-group-input">
                            <div class="port-group-label">${escapeHtml(FINAL_OUTPUT_BINDING)}</div>
                            <div class="ports-stack ports-stack-input">
                                <button
                                    type="button"
                                    class="port port-kind-default ${graph.outputs[FINAL_OUTPUT_BINDING] ? 'is-connected' : ''}"
                                    data-port-side="input"
                                    data-ref="output.${escapeHtml(FINAL_OUTPUT_BINDING)}"
                                    data-binding="${escapeHtml(FINAL_OUTPUT_BINDING)}"
                                    data-port-name="${escapeHtml(FINAL_OUTPUT_BINDING)}"
                                    data-socket-index="0"
                                    data-accept-kinds="*"
                                    title="${escapeHtml(FINAL_OUTPUT_BINDING)}"
                                ></button>
                            </div>
                        </div>
                    </div>
                    <div class="block-content system-block-content">
                        <p>Executable result binding</p>
                    </div>
                </div>
            </article>
        `;
    }

    function renderPalette(model) {
        paletteRoot.innerHTML = model.paletteGroups.map(group => `
            <section class="palette-group">
                <h3>${escapeHtml(group.group)}</h3>
                ${group.blocks.map(block => `
                    <button
                        class="palette-block"
                        type="button"
                        draggable="true"
                        data-block-id="${escapeHtml(block.block_id)}"
                    >
                        ${escapeHtml(block.block_id)}
                    </button>
                `).join('')}
            </section>
        `).join('');

        paletteRoot.querySelectorAll('[data-block-id]').forEach(button => {
            button.addEventListener('click', () => addNode(button.getAttribute('data-block-id')));
            button.addEventListener('dragstart', (event) => {
                const blockId = button.getAttribute('data-block-id');

                event.dataTransfer.setData('text/plain', blockId);
                event.dataTransfer.effectAllowed = 'copy';
            });
        });
    }

    function renderBlocks(model) {
        const nodeMarkup = model.nodeCards.map(card => {
            const block = findBlock(card.block_id) || { params: [] };

            return `
                <article
                    class="canvas-block"
                    data-node-id="${escapeHtml(card.node_id)}"
                    style="left:${card.position.x}px; top:${card.position.y}px;"
                >
                    <div class="block-header" data-drag-kind="node" data-node-id="${escapeHtml(card.node_id)}">
                        <span>${escapeHtml(card.title)}</span>
                        <button class="delete-btn" type="button" data-delete-node="${escapeHtml(card.node_id)}">✕</button>
                    </div>
                    <div class="block-body">
                        <div class="port-side port-side-left">
                            ${renderInputPortGroups(card.node_id, card.inputPorts || [])}
                        </div>
                        <div class="block-content">
                            ${renderParamControls(card, block)}
                        </div>
                        <div class="port-side port-side-right">
                            ${renderOutputPortGroups(card.node_id, card.outputPorts || [])}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        const emptyState = graph.nodes.length === 0
            ? `
                <div class="empty-state">
                    Drag blocks into the canvas, move them around, then connect sockets manually.
                </div>
            `
            : '';

        blocksLayer.innerHTML = `
            ${renderSystemInputBlock()}
            ${renderSystemOutputBlock()}
            ${emptyState}
            ${nodeMarkup}
        `;
    }

    function bindCanvasInteractions() {
        if (!canvasDropBound) {
            canvas.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            });

            canvas.addEventListener('drop', (event) => {
                event.preventDefault();

                const blockId = event.dataTransfer.getData('text/plain');
                if (!blockId) {
                    return;
                }

                const rect = blocksLayer.getBoundingClientRect();
                addNode(blockId, {
                    x: event.clientX - rect.left - 110,
                    y: event.clientY - rect.top - 60
                });
            });

            canvasDropBound = true;
        }

        blocksLayer.querySelectorAll('[data-delete-node]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                removeNode(button.getAttribute('data-delete-node'));
            });
        });

        blocksLayer.querySelectorAll('[data-slot-control]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();

                const action = button.getAttribute('data-slot-control');
                const nodeId = button.getAttribute('data-node-id');
                const portName = button.getAttribute('data-port-name');
                const binding = button.getAttribute('data-binding');
                const node = nodeId ? findNode(nodeId) : null;
                const bucketName = action.includes('input') ? 'input_slots' : 'output_slots';
                const currentCount = binding
                    ? getSystemInputSlotCount(binding)
                    : (node && node.ui && node.ui[bucketName] && node.ui[bucketName][portName]) || 1;

                if (action === 'add-input') {
                    setNodeSlotCount(nodeId, 'input', portName, currentCount + 1);
                } else if (action === 'remove-input') {
                    setNodeSlotCount(nodeId, 'input', portName, currentCount - 1);
                } else if (action === 'add-output') {
                    setNodeSlotCount(nodeId, 'output', portName, currentCount + 1);
                } else if (action === 'remove-output') {
                    setNodeSlotCount(nodeId, 'output', portName, currentCount - 1);
                } else if (action === 'add-system-output') {
                    setSystemInputSlotCount(binding, currentCount + 1);
                } else if (action === 'remove-system-output') {
                    setSystemInputSlotCount(binding, currentCount - 1);
                }
            });
        });

        blocksLayer.querySelectorAll('[data-param-name]').forEach(control => {
            control.addEventListener('change', () => {
                updateParam(
                    control.getAttribute('data-node-id'),
                    control.getAttribute('data-param-name'),
                    control.value
                );
            });
        });

        blocksLayer.querySelectorAll('.block-header[data-drag-kind]').forEach(header => {
            header.addEventListener('mousedown', (event) => {
                if (event.target.closest('button')) {
                    return;
                }

                const blockElement = header.closest('.canvas-block');
                const dragKind = header.getAttribute('data-drag-kind');
                const nodeId = header.getAttribute('data-node-id');
                const systemKind = header.getAttribute('data-system-kind');
                const initialLeft = parseFloat(blockElement.style.left || '0');
                const initialTop = parseFloat(blockElement.style.top || '0');

                dragState = {
                    kind: dragKind,
                    nodeId,
                    systemKind,
                    element: blockElement,
                    startX: event.clientX,
                    startY: event.clientY,
                    initialLeft,
                    initialTop,
                    width: blockElement.offsetWidth,
                    height: blockElement.offsetHeight
                };

                blockElement.classList.add('active');
                event.preventDefault();
            });
        });

        blocksLayer.querySelectorAll('.port').forEach(port => {
            port.addEventListener('mousedown', (event) => {
                event.stopPropagation();
                startPendingConnection(port, 'drag');
            });

            port.addEventListener('mouseup', (event) => {
                event.stopPropagation();

                if (pendingConnection && pendingConnection.mode === 'drag') {
                    connectSockets(pendingConnection, readSocketDescriptor(port));
                    clearPendingConnection();
                    suppressNextSocketClick();
                }
            });

            port.addEventListener('click', (event) => {
                event.stopPropagation();

                if (suppressSocketClick) {
                    return;
                }

                if (!pendingConnection || pendingConnection.mode !== 'click') {
                    startPendingConnection(port, 'click');
                    return;
                }

                if (pendingConnection.element === port) {
                    clearPendingConnection();
                    return;
                }

                connectSockets(pendingConnection, readSocketDescriptor(port));
                clearPendingConnection();
            });
        });
    }

    function updatePanels() {
        if (lastRunResult) {
            outputNode.textContent = JSON.stringify(lastRunResult.outputs, null, 2);
            diagnosticsNode.textContent = JSON.stringify(lastRunResult.diagnostics, null, 2);
            return;
        }

        outputNode.textContent = JSON.stringify(graph.outputs || {}, null, 2);
        diagnosticsNode.textContent = JSON.stringify(
            { graph: FlowGraph.serializeGraph(graph) },
            null,
            2
        );
    }

    function render() {
        ensureGraphUi();

        const model = FlowBuilderViewModel.createBuilderViewModel({
            catalog,
            graph,
            selection: {
                activeSourcePort: pendingConnection && pendingConnection.side === 'output'
                    ? pendingConnection.ref
                    : null
            }
        });

        renderPalette(model);
        renderBlocks(model);
        bindCanvasInteractions();
        updatePanels();
        updateWires();
    }

    document.addEventListener('mousemove', (event) => {
        if (dragState) {
            const nextPosition = clampPosition({
                x: dragState.initialLeft + (event.clientX - dragState.startX),
                y: dragState.initialTop + (event.clientY - dragState.startY)
            }, {
                width: dragState.width,
                height: dragState.height
            });

            dragState.element.style.left = `${nextPosition.x}px`;
            dragState.element.style.top = `${nextPosition.y}px`;

            if (dragState.kind === 'node') {
                const node = findNode(dragState.nodeId);
                if (node) {
                    if (!node.ui || typeof node.ui !== 'object') {
                        node.ui = {};
                    }

                    node.ui.position = nextPosition;
                }
            } else {
                setSystemNodePosition(dragState.systemKind, nextPosition);
            }

            updateWires();
            return;
        }

        if (pendingConnection) {
            const layerRect = wiresLayer.getBoundingClientRect();

            pendingConnection.currentPos = {
                x: event.clientX - layerRect.left,
                y: event.clientY - layerRect.top
            };

            updateWires();
        }
    });

    document.addEventListener('mouseup', () => {
        if (dragState) {
            dragState.element.classList.remove('active');
            dragState = null;
            persistGraph();
            updateWires();
            return;
        }

        if (pendingConnection && pendingConnection.mode === 'drag') {
            clearPendingConnection();
            suppressNextSocketClick();
        }
    });

    window.addEventListener('resize', () => {
        updateWires();
    });

    runButton.addEventListener('click', async () => {
        const errors = FlowGraph.validateGraph(graph, catalog);

        if (!graph.outputs[FINAL_OUTPUT_BINDING]) {
            errors.push('connect a block to the final output socket before running');
        }

        if (errors.length > 0) {
            setStatus('flow-run-invalid', 'Fix graph validation errors before running.');
            outputNode.textContent = '';
            diagnosticsNode.textContent = JSON.stringify({ errors }, null, 2);
            return;
        }

        setStatus('flow-run-running', 'Running native pipeline...');

        try {
            const result = await getRuntime().runGraph({
                graph: FlowGraph.serializeGraph(graph),
                inputs: buildDemoInputs()
            });

            lastRunResult = result;
            updatePanels();
            setStatus('flow-run-complete', 'Native pipeline complete');
        } catch (error) {
            lastRunResult = null;
            outputNode.textContent = '';
            diagnosticsNode.textContent = JSON.stringify({ error: error.message }, null, 2);
            setStatus('flow-run-error', 'Native runtime failed');
        }
    });

    if (uploadButton) {
        uploadButton.addEventListener('click', async () => {
            const errors = FlowGraph.validateGraph(graph, catalog);

            if (errors.length > 0) {
                setUploadStatus('Fix graph validation errors before upload.');
                diagnosticsNode.textContent = JSON.stringify({ errors }, null, 2);
                return;
            }

            if (!globalThis.FlowCompiler || !globalThis.FlowBleUpload) {
                setUploadStatus('Upload tools are unavailable.');
                return;
            }

            uploadButton.disabled = true;
            if (uploadProgress) {
                uploadProgress.value = 0;
            }
            setUploadStatus('Preparing upload...');

            try {
                const binary = globalThis.FlowCompiler.compileGraph(FlowGraph.serializeGraph(graph));
                setUploadStatus(`Uploading ${binary.length} bytes...`);
                const status = await globalThis.FlowBleUpload.uploadPipeline(binary, progress => {
                    if (uploadProgress) {
                        uploadProgress.value = progress;
                    }
                });
                setUploadStatus(`Upload accepted: 0x${status.toString(16).padStart(2, '0')}`);
            } catch (error) {
                setUploadStatus(error.message || 'Upload failed.');
                diagnosticsNode.textContent = JSON.stringify({ error: error.message }, null, 2);
            } finally {
                uploadButton.disabled = false;
            }
        });
    }

    try {
        catalog = await FlowCatalog.loadCatalog();
        setStatus('flow-status-ready', 'Catalog ready');
        render();
    } catch (error) {
        setStatus('flow-status-error', 'Catalog failed to load');
        diagnosticsNode.textContent = JSON.stringify({ error: error.message }, null, 2);
    }
});
