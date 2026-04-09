document.addEventListener('DOMContentLoaded', async () => {
    const paletteRoot = document.getElementById('palette-groups');
    const blocksLayer = document.getElementById('blocks-layer');
    const outputNode = document.getElementById('graph-output-list');
    const diagnosticsNode = document.getElementById('runtime-diagnostics');
    const statusNode = document.getElementById('catalog-status');
    const runButton = document.getElementById('run-sim-btn');

    if (!paletteRoot || !blocksLayer || !outputNode || !diagnosticsNode || !statusNode || !runButton) {
        return;
    }

    const runtime = FlowRuntimeClient.createFlowRuntimeClient();
    let catalog = null;
    let graph = FlowGraph.createGraphState();
    let selection = { activeSourcePort: null };

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

    function parseDefaultValue(param) {
        if (!param || !Object.prototype.hasOwnProperty.call(param, 'default')) {
            return null;
        }

        return param.default;
    }

    function findBlock(blockId) {
        return catalog && catalog.byId ? catalog.byId[blockId] : null;
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

    function addConnectionIfMissing(source, target) {
        if (graph.connections.some(connection => connection.source === source && connection.target === target)) {
            return;
        }

        graph.connections.push({ source, target });
    }

    function addNode(blockId) {
        const block = findBlock(blockId);
        const nodeId = `n${graph.nodes.length + 1}`;
        const params = {};

        if (!block) {
            return;
        }

        for (const param of block.params || []) {
            params[param.name] = parseDefaultValue(param);
        }

        graph.nodes.push({ node_id: nodeId, block_id: block.block_id, params });

        if (graph.nodes.length === 1) {
            const rawInput = (block.inputs || []).find(input => Array.isArray(input.kinds) && input.kinds.includes('raw_window'));
            if (rawInput) {
                addConnectionIfMissing('input.raw', `${nodeId}.${rawInput.name}`);
            }
        } else {
            const previousNode = graph.nodes[graph.nodes.length - 2];
            const previousBlock = findBlock(previousNode.block_id);
            const previousOutput = previousBlock && Array.isArray(previousBlock.outputs)
                ? previousBlock.outputs[0]
                : null;
            const compatibleInput = (block.inputs || []).find(input => (
                previousOutput &&
                Array.isArray(input.kinds) &&
                input.kinds.includes(previousOutput.kind)
            ));

            if (previousOutput && compatibleInput) {
                addConnectionIfMissing(
                    `${previousNode.node_id}.${previousOutput.name}`,
                    `${nodeId}.${compatibleInput.name}`
                );
            }
        }

        if (Array.isArray(block.outputs) && block.outputs.length > 0) {
            graph.outputs.final = `${nodeId}.${block.outputs[0].name}`;
            selection = { activeSourcePort: graph.outputs.final };
        }

        render();
    }

    function renderPalette(model) {
        paletteRoot.innerHTML = model.paletteGroups.map(group => `
            <section class="palette-group">
                <h3>${group.group}</h3>
                ${group.blocks.map(block => `
                    <button class="palette-block" type="button" data-block-id="${block.block_id}">
                        ${block.block_id}
                    </button>
                `).join('')}
            </section>
        `).join('');

        paletteRoot.querySelectorAll('[data-block-id]').forEach(button => {
            button.addEventListener('click', () => addNode(button.getAttribute('data-block-id')));
        });
    }

    function renderBlocks(model) {
        if (model.nodeCards.length === 0) {
            blocksLayer.innerHTML = `
                <div class="empty-state">
                    Add blocks from the left to build a manifest-driven DSP chain. Compatible ports pick up their packet-kind colors automatically.
                </div>
            `;
            return;
        }

        blocksLayer.innerHTML = model.nodeCards.map(card => `
            <article class="builder-node-card">
                <div class="builder-node-card-header">
                    <h3>${card.title}</h3>
                    <span class="builder-node-chip">${card.node_id}</span>
                </div>
                <section class="builder-node-section">
                    <h4>Inputs</h4>
                    <div class="port-list">
                        ${(card.inputs || []).map(input => `
                            <span class="port-badge ${input.colorClass} ${selection.activeSourcePort && !input.acceptsActiveConnection ? 'is-incompatible' : ''}">
                                ${input.name}
                            </span>
                        `).join('')}
                    </div>
                </section>
                <section class="builder-node-section">
                    <h4>Outputs</h4>
                    <div class="port-list">
                        ${(card.outputs || []).map(output => `
                            <span class="port-badge ${output.colorClass} ${output.isActiveSource ? 'is-active-source' : ''}">
                                ${output.name}
                            </span>
                        `).join('')}
                    </div>
                </section>
                <section class="builder-node-section">
                    <h4>Params</h4>
                    <div class="param-list">
                        ${Object.keys(card.params || {}).length > 0
                            ? Object.entries(card.params).map(([name, value]) => `
                                <span class="param-chip">${name}: ${String(value)}</span>
                            `).join('')
                            : '<span class="param-chip">default</span>'}
                    </div>
                </section>
            </article>
        `).join('');
    }

    function render() {
        const model = FlowBuilderViewModel.createBuilderViewModel({
            catalog,
            graph,
            selection
        });

        renderPalette(model);
        renderBlocks(model);
    }

    runButton.addEventListener('click', async () => {
        const errors = FlowGraph.validateGraph(graph, catalog);

        if (errors.length > 0) {
            setStatus('flow-run-invalid', 'Fix graph validation errors before running.');
            outputNode.textContent = '';
            diagnosticsNode.textContent = JSON.stringify({ errors }, null, 2);
            return;
        }

        setStatus('flow-run-running', 'Running native pipeline...');
        diagnosticsNode.textContent = JSON.stringify({ graph: FlowGraph.serializeGraph(graph) }, null, 2);

        try {
            const result = await runtime.runGraph({
                graph: FlowGraph.serializeGraph(graph),
                inputs: buildDemoInputs()
            });

            outputNode.textContent = JSON.stringify(result.outputs, null, 2);
            diagnosticsNode.textContent = JSON.stringify(result.diagnostics, null, 2);
            setStatus('flow-run-complete', 'Native pipeline complete');
        } catch (error) {
            outputNode.textContent = '';
            diagnosticsNode.textContent = JSON.stringify({ error: error.message }, null, 2);
            setStatus('flow-run-error', 'Native runtime failed');
        }
    });

    try {
        catalog = await FlowCatalog.loadCatalog();
        setStatus('flow-status-ready', 'Catalog ready');
        outputNode.textContent = JSON.stringify(graph.outputs, null, 2);
        diagnosticsNode.textContent = JSON.stringify(
            { note: 'Add blocks in sequence to build a default demo pipeline.' },
            null,
            2
        );
        render();
    } catch (error) {
        setStatus('flow-status-error', 'Catalog failed to load');
        diagnosticsNode.textContent = JSON.stringify({ error: error.message }, null, 2);
    }
});
