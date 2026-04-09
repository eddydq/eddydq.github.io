(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowBuilderViewModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const GROUP_ORDER = ['representation', 'pretraitement', 'estimation', 'detection', 'validation', 'suivi'];
    const KIND_CLASS = {
        raw_window: 'port-kind-raw-window',
        series: 'port-kind-series',
        candidate: 'port-kind-candidate',
        estimate: 'port-kind-estimate'
    };

    function getBlockList(catalog) {
        return Array.isArray(catalog && catalog.blocks) ? catalog.blocks : [];
    }

    function getBlockById(catalog) {
        const blockMap = new Map();

        for (const block of getBlockList(catalog)) {
            blockMap.set(block.block_id, block);
        }

        return blockMap;
    }

    function splitRef(ref) {
        const value = String(ref || '');
        const dotIndex = value.indexOf('.');

        if (dotIndex === -1) {
            return { node_id: value, port: '' };
        }

        return {
            node_id: value.slice(0, dotIndex),
            port: value.slice(dotIndex + 1)
        };
    }

    function findActiveOutputKind(catalog, activeSourcePort) {
        const blockById = getBlockById(catalog);
        const source = splitRef(activeSourcePort);

        if (!source.node_id || source.node_id === 'input') {
            const systemInputs = catalog && catalog.systemInputs ? catalog.systemInputs : {};
            return systemInputs[source.port] || null;
        }

        const graphNodes = Array.isArray(catalog && catalog.graphNodes) ? catalog.graphNodes : [];
        const sourceNode = graphNodes.find(node => node.node_id === source.node_id);
        const sourceBlock = sourceNode ? blockById.get(sourceNode.block_id) : null;
        const sourceOutput = sourceBlock && Array.isArray(sourceBlock.outputs)
            ? sourceBlock.outputs.find(output => output.name === source.port)
            : null;

        return sourceOutput ? sourceOutput.kind : null;
    }

    function createBuilderViewModel({ catalog, graph, selection }) {
        const blocks = getBlockList(catalog);
        const paletteGroups = GROUP_ORDER
            .map(group => ({
                group,
                blocks: blocks.filter(block => block.group === group)
            }))
            .filter(group => group.blocks.length > 0);
        const blockById = getBlockById(catalog);
        const graphNodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
        const activeSourcePort = selection && selection.activeSourcePort
            ? selection.activeSourcePort
            : null;
        const activeCatalog = {
            ...(catalog || {}),
            graphNodes
        };
        const activeKind = activeSourcePort ? findActiveOutputKind(activeCatalog, activeSourcePort) : null;

        const nodeCards = graphNodes.map(node => {
            const block = blockById.get(node.block_id) || { inputs: [], outputs: [] };

            return {
                node_id: node.node_id,
                title: node.block_id,
                block_id: node.block_id,
                params: node.params || {},
                inputs: (block.inputs || []).map(input => ({
                    ...input,
                    colorClass: KIND_CLASS[input.kinds && input.kinds[0]] || 'port-kind-default',
                    acceptsActiveConnection: Boolean(
                        activeKind &&
                        Array.isArray(input.kinds) &&
                        input.kinds.includes(activeKind)
                    )
                })),
                outputs: (block.outputs || []).map(output => ({
                    ...output,
                    colorClass: KIND_CLASS[output.kind] || 'port-kind-default',
                    isActiveSource: activeSourcePort === `${node.node_id}.${output.name}`
                }))
            };
        });

        return {
            paletteGroups,
            nodeCards
        };
    }

    return { createBuilderViewModel };
}));
