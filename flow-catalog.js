(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowCatalog = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const KIND_STYLE = {
        raw_window: { colorClass: 'port-kind-raw-window' },
        series: { colorClass: 'port-kind-series' },
        candidate: { colorClass: 'port-kind-candidate' },
        estimate: { colorClass: 'port-kind-estimate' }
    };

    function normalizeCatalog(source) {
        const blocks = Array.isArray(source && source.blocks) ? source.blocks : [];
        const normalizedBlocks = [];
        const byId = {};
        const systemInputs = source && typeof source.system_inputs === 'object'
            ? source.system_inputs
            : {};

        for (const block of blocks) {
            const normalizedBlock = {
                ...block,
                inputs: Array.isArray(block.inputs)
                    ? block.inputs
                    : (Array.isArray(block.input_ports) ? block.input_ports : []),
                outputs: Array.isArray(block.outputs)
                    ? block.outputs
                    : (Array.isArray(block.output_ports) ? block.output_ports : []),
                params: Array.isArray(block.params) ? block.params : [],
                stateful: Boolean(block.stateful)
            };

            normalizedBlocks.push(normalizedBlock);
            if (normalizedBlock.block_id) {
                byId[normalizedBlock.block_id] = normalizedBlock;
            }
        }

        return {
            blocks: normalizedBlocks,
            byId,
            byKind: KIND_STYLE,
            systemInputs
        };
    }

    async function loadCatalog(fetchImpl = globalThis.fetch) {
        if (typeof fetchImpl !== 'function') {
            throw new Error('fetch is not available');
        }

        const response = await fetchImpl('assets/flow-block-catalog.json');
        const json = await response.json();
        return normalizeCatalog(json);
    }

    return { normalizeCatalog, loadCatalog };
}));
