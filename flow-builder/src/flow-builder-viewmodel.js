(function(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowBuilderViewModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const GROUP_ORDER = ['source', 'representation', 'pretraitement', 'estimation', 'detection', 'validation', 'suivi'];
    const KIND_CLASS = {
        raw_window: 'port-kind-raw-window',
        series: 'port-kind-series',
        candidate: 'port-kind-candidate',
        estimate: 'port-kind-estimate'
    };

    function getManagedSourceApi() {
        if (typeof root !== 'undefined' && root.FlowManagedSource) {
            return root.FlowManagedSource;
        }

        if (typeof require === 'function') {
            try {
                return require('./flow-managed-source.js');
            } catch (error) {
                void error;
            }
        }

        return null;
    }

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

    function getNodePosition(node, index) {
        const position = node && node.ui && node.ui.position ? node.ui.position : null;

        if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
            return {
                x: position.x,
                y: position.y
            };
        }

        return {
            x: 120 + (index * 260),
            y: 120 + ((index % 2) * 120)
        };
    }

    function getStoredSlotCount(node, side, portName) {
        const bucketName = side === 'input' ? 'input_slots' : 'output_slots';
        const bucket = node && node.ui && node.ui[bucketName] && typeof node.ui[bucketName] === 'object'
            ? node.ui[bucketName]
            : {};
        const value = bucket[portName];

        return Number.isInteger(value) && value > 0 ? value : null;
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

    function indexConnectionsBySocket(connections, refField, socketField) {
        const grouped = new Map();

        for (const connection of Array.isArray(connections) ? connections : []) {
            const ref = connection && typeof connection[refField] === 'string'
                ? connection[refField]
                : null;

            if (!ref) {
                continue;
            }

            if (!grouped.has(ref)) {
                grouped.set(ref, []);
            }

            grouped.get(ref).push(connection);
        }

        const indexed = new Map();

        for (const [ref, refConnections] of grouped.entries()) {
            const slotMap = new Map();
            let nextFallbackSlot = 0;

            for (const connection of refConnections) {
                const explicitSlot = connection[socketField];
                const slotIndex = Number.isInteger(explicitSlot) && explicitSlot >= 0
                    ? explicitSlot
                    : nextFallbackSlot;

                nextFallbackSlot = Math.max(nextFallbackSlot, slotIndex + 1);

                if (!slotMap.has(slotIndex)) {
                    slotMap.set(slotIndex, []);
                }

                slotMap.get(slotIndex).push(connection);
            }

            indexed.set(ref, slotMap);
        }

        return indexed;
    }

    function getSlotCount({ node, side, portName, slotMap, minimumCount }) {
        const storedCount = getStoredSlotCount(node, side, portName) || 0;
        const actualSocketCount = slotMap
            ? Array.from(slotMap.keys()).reduce((maxValue, slotIndex) => Math.max(maxValue, slotIndex + 1), 0)
            : 0;

        return Math.max(minimumCount, storedCount, actualSocketCount);
    }

    function createInputPorts({ graph, node, block, activeKind, targetConnections }) {
        return (block.inputs || []).map(input => {
            const targetRef = `${node.node_id}.${input.name}`;
            const slotMap = targetConnections.get(targetRef) || new Map();
            const minimumCount = input.cardinality === 'many' ? 1 : 1;
            const slotCount = input.cardinality === 'many'
                ? getSlotCount({ node, side: 'input', portName: input.name, slotMap, minimumCount })
                : 1;

            return {
                ...input,
                colorClass: KIND_CLASS[input.kinds && input.kinds[0]] || 'port-kind-default',
                canAddSlot: input.cardinality === 'many',
                canRemoveSlot: input.cardinality === 'many' && slotCount > 1,
                slots: Array.from({ length: slotCount }, (_, slotIndex) => {
                    const slotConnections = slotMap.get(slotIndex) || [];

                    return {
                        socketId: `${node.node_id}:input:${input.name}:${slotIndex}`,
                        slotIndex,
                        targetRef,
                        colorClass: KIND_CLASS[input.kinds && input.kinds[0]] || 'port-kind-default',
                        acceptsActiveConnection: Boolean(
                            activeKind &&
                            Array.isArray(input.kinds) &&
                            input.kinds.includes(activeKind)
                        ),
                        isConnected: slotConnections.length > 0,
                        connectionCount: slotConnections.length
                    };
                })
            };
        });
    }

    function createOutputPorts({ graph, node, block, activeSourcePort, sourceConnections }) {
        return (block.outputs || []).map(output => {
            const sourceRef = `${node.node_id}.${output.name}`;
            const slotMap = sourceConnections.get(sourceRef) || new Map();
            const slotCount = getSlotCount({
                node,
                side: 'output',
                portName: output.name,
                slotMap,
                minimumCount: 1
            });

            return {
                ...output,
                colorClass: KIND_CLASS[output.kind] || 'port-kind-default',
                canAddSlot: true,
                canRemoveSlot: slotCount > 1,
                slots: Array.from({ length: slotCount }, (_, slotIndex) => {
                    const slotConnections = slotMap.get(slotIndex) || [];

                    return {
                        socketId: `${node.node_id}:output:${output.name}:${slotIndex}`,
                        slotIndex,
                        sourceRef,
                        colorClass: KIND_CLASS[output.kind] || 'port-kind-default',
                        isActiveSource: activeSourcePort === sourceRef,
                        isConnected: slotConnections.length > 0,
                        connectionCount: slotConnections.length
                    };
                })
            };
        });
    }

    function createBuilderViewModel({ catalog, graph, selection }) {
        const managedSourceApi = getManagedSourceApi();
        const managedSourceGraph = managedSourceApi && typeof managedSourceApi.ensureManagedSourceGraph === 'function'
            ? managedSourceApi.ensureManagedSourceGraph(graph)
            : graph;
        const managedSourceInspection = managedSourceApi && typeof managedSourceApi.inspectManagedSourceGraph === 'function'
            ? managedSourceApi.inspectManagedSourceGraph(managedSourceGraph)
            : null;
        const hiddenPaletteBlockIds = managedSourceApi && typeof managedSourceApi.getHiddenPaletteBlockIds === 'function'
            ? new Set(managedSourceApi.getHiddenPaletteBlockIds())
            : new Set();
        const blocks = getBlockList(catalog);
        const paletteGroups = GROUP_ORDER
            .map(group => ({
                group,
                blocks: blocks.filter(block => block.group === group && !hiddenPaletteBlockIds.has(block.block_id))
            }))
            .filter(group => group.blocks.length > 0);
        const blockById = getBlockById(catalog);
        const graphNodes = Array.isArray(managedSourceGraph && managedSourceGraph.nodes) ? managedSourceGraph.nodes : [];
        const hiddenNodeIds = new Set(
            managedSourceInspection && Array.isArray(managedSourceInspection.hiddenNodeIds)
                ? managedSourceInspection.hiddenNodeIds
                : []
        );
        const activeSourcePort = selection && selection.activeSourcePort
            ? selection.activeSourcePort
            : null;
        const activeCatalog = {
            ...(catalog || {}),
            graphNodes
        };
        const activeKind = activeSourcePort ? findActiveOutputKind(activeCatalog, activeSourcePort) : null;
        const sourceConnections = indexConnectionsBySocket(managedSourceGraph && managedSourceGraph.connections, 'source', 'source_socket');
        const targetConnections = indexConnectionsBySocket(managedSourceGraph && managedSourceGraph.connections, 'target', 'target_socket');

        const nodeCards = graphNodes
            .filter(node => !hiddenNodeIds.has(node.node_id))
            .map((node, index) => {
                const block = blockById.get(node.block_id) || { inputs: [], outputs: [] };
                const inputPorts = createInputPorts({
                    graph,
                    node,
                    block,
                    activeKind,
                    targetConnections
                });
                const outputPorts = createOutputPorts({
                    graph,
                    node,
                    block,
                    activeSourcePort,
                    sourceConnections
                });

                return {
                    node_id: node.node_id,
                    title: node.block_id,
                    block_id: node.block_id,
                    params: node.params || {},
                    position: getNodePosition(node, index),
                    inputs: inputPorts,
                    outputs: outputPorts,
                    inputPorts,
                    outputPorts
                };
            });

        const systemSourceCard = managedSourceInspection
            ? {
                title: 'Source',
                output: {
                    ref: managedSourceInspection.outputRef,
                    kind: 'series'
                },
                fields: [
                    {
                        name: 'source',
                        value: managedSourceInspection.selection.source,
                        options: managedSourceInspection.options.source.slice()
                    },
                    {
                        name: 'sample_rate_hz',
                        value: managedSourceInspection.selection.sample_rate_hz,
                        options: managedSourceInspection.options.sample_rate_hz.slice()
                    },
                    {
                        name: 'resolution',
                        value: managedSourceInspection.selection.resolution,
                        options: managedSourceInspection.options.resolution.slice()
                    },
                    {
                        name: 'axis',
                        value: managedSourceInspection.selection.axis,
                        options: managedSourceInspection.options.axis.slice()
                    }
                ]
            }
            : null;

        return {
            paletteGroups,
            systemSourceCard,
            nodeCards
        };
    }

    return { createBuilderViewModel };
}));
