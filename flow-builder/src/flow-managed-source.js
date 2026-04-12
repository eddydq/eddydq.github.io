(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowManagedSource = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const AXIS_OPTIONS = ['x', 'y', 'z'];
    const SOURCE_CONFIG = {
        'source.lis3dh': {
            sample_rate_hz: [1, 10, 25, 50, 100, 200, 400],
            resolution: [8, 10, 12],
            defaults: {
                sample_rate_hz: 100,
                resolution: 12
            }
        },
        'source.mpu6050': {
            sample_rate_hz: [4, 10, 25, 50, 100, 200, 400, 1000],
            resolution: [16],
            defaults: {
                sample_rate_hz: 100,
                resolution: 16
            }
        },
        'source.polar': {
            sample_rate_hz: [52],
            resolution: [16],
            defaults: {
                sample_rate_hz: 52,
                resolution: 16
            }
        }
    };

    const HIDDEN_PALETTE_BLOCK_IDS = Object.freeze([
        'source.lis3dh',
        'source.mpu6050',
        'source.polar',
        'representation.select_axis',
        'representation.vector_magnitude'
    ]);

    function getFlowGraphApi() {
        if (typeof root !== 'undefined' && root.FlowGraph) {
            return root.FlowGraph;
        }

        if (typeof require === 'function') {
            try {
                return require('./flow-graph.js');
            } catch (error) {
                void error;
            }
        }

        return null;
    }

    function cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(cloneValue);
        }

        if (value && typeof value === 'object') {
            const copy = {};

            for (const [key, entry] of Object.entries(value)) {
                copy[key] = cloneValue(entry);
            }

            return copy;
        }

        return value;
    }

    function createGraphState(overrides = {}) {
        const flowGraph = getFlowGraphApi();

        if (flowGraph && typeof flowGraph.createGraphState === 'function') {
            return flowGraph.createGraphState(overrides);
        }

        return {
            schema_version: 2,
            nodes: Array.isArray(overrides.nodes) ? overrides.nodes.map(cloneValue) : [],
            connections: Array.isArray(overrides.connections) ? overrides.connections.map(cloneValue) : [],
            outputs: overrides && overrides.outputs && typeof overrides.outputs === 'object' ? cloneValue(overrides.outputs) : {},
            ui: overrides && overrides.ui && typeof overrides.ui === 'object' ? cloneValue(overrides.ui) : {}
        };
    }

    function normalizeGraph(graph) {
        return createGraphState(graph || {});
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

    function isManagedSourceBlock(blockId) {
        return Object.prototype.hasOwnProperty.call(SOURCE_CONFIG, blockId);
    }

    function isManagedRepresentationBlock(blockId) {
        return blockId === 'representation.select_axis' || blockId === 'representation.vector_magnitude';
    }

    function isManagedResetBlock(blockId) {
        return isManagedSourceBlock(blockId) || isManagedRepresentationBlock(blockId);
    }

    function getSourceNodes(graph) {
        return graph.nodes.filter(node => isManagedSourceBlock(node && node.block_id));
    }

    function getAxisNodes(graph) {
        return graph.nodes.filter(node => node && node.block_id === 'representation.select_axis');
    }

    function getNodeById(graph, nodeId) {
        return graph.nodes.find(node => node.node_id === nodeId) || null;
    }

    function getConnectionsFrom(graph, nodeId, portName) {
        return graph.connections.filter(connection => {
            const source = splitRef(connection.source);
            return source.node_id === nodeId && source.port === portName;
        });
    }

    function getConnectionsTo(graph, nodeId, portName) {
        return graph.connections.filter(connection => {
            const target = splitRef(connection.target);
            return target.node_id === nodeId && target.port === portName;
        });
    }

    function validateAxis(axis) {
        return AXIS_OPTIONS.includes(axis) ? axis : 'z';
    }

    function validateScalarOption(value, allowedValues, fallback) {
        return allowedValues.includes(value) ? value : fallback;
    }

    function createDefaultSourceNode() {
        return {
            node_id: 'managed-source',
            block_id: 'source.polar',
            params: {
                sample_rate_hz: SOURCE_CONFIG['source.polar'].defaults.sample_rate_hz,
                resolution: SOURCE_CONFIG['source.polar'].defaults.resolution
            },
            ui: { hidden: true }
        };
    }

    function createDefaultAxisNode() {
        return {
            node_id: 'managed-axis',
            block_id: 'representation.select_axis',
            params: { axis: 'z' },
            ui: { hidden: true }
        };
    }

    function buildSeededGraph(graph) {
        const state = normalizeGraph(graph);

        if (state.nodes.length > 0 || state.connections.length > 0) {
            inspectManagedSourceGraph(state);
            return state;
        }

        const sourceNode = createDefaultSourceNode();
        const axisNode = createDefaultAxisNode();

        return createGraphState({
            ...state,
            nodes: [sourceNode, axisNode],
            connections: [
                {
                    source: `${sourceNode.node_id}.primary`,
                    target: `${axisNode.node_id}.source`
                }
            ]
        });
    }

    function ensureManagedSourceGraph(graph) {
        return buildSeededGraph(graph);
    }

    function inspectManagedSourceGraph(graph) {
        const state = normalizeGraph(graph);
        const sourceNodes = getSourceNodes(state);
        const axisNodes = getAxisNodes(state);

        if (sourceNodes.length !== 1) {
            throw new Error(`managed source graph must contain exactly one source node; found ${sourceNodes.length}`);
        }

        if (axisNodes.length !== 1) {
            throw new Error(`managed source graph must contain exactly one representation.select_axis node; found ${axisNodes.length}`);
        }

        const sourceNode = sourceNodes[0];
        const axisNode = axisNodes[0];
        const sourceConfig = SOURCE_CONFIG[sourceNode.block_id];

        if (!sourceConfig) {
            throw new Error(`unknown managed source block: ${sourceNode.block_id}`);
        }

        const sourceConnections = getConnectionsFrom(state, sourceNode.node_id, 'primary');
        const axisConnections = getConnectionsTo(state, axisNode.node_id, 'source');
        const directConnections = state.connections.filter(connection => (
            splitRef(connection.source).node_id === sourceNode.node_id &&
            splitRef(connection.source).port === 'primary' &&
            splitRef(connection.target).node_id === axisNode.node_id &&
            splitRef(connection.target).port === 'source'
        ));

        if (sourceConnections.length !== 1 || directConnections.length !== 1) {
            throw new Error('managed source graph must feed exactly one representation.select_axis node');
        }

        if (axisConnections.length !== 1 || directConnections.length !== 1) {
            throw new Error('managed source graph must feed exactly one representation.select_axis node');
        }

        return {
            graph: state,
            sourceNode,
            axisNode,
            sourceBlockId: sourceNode.block_id,
            selection: {
                source: sourceNode.block_id,
                sample_rate_hz: sourceNode.params && Object.prototype.hasOwnProperty.call(sourceNode.params, 'sample_rate_hz')
                    ? sourceNode.params.sample_rate_hz
                    : sourceConfig.defaults.sample_rate_hz,
                resolution: sourceNode.params && Object.prototype.hasOwnProperty.call(sourceNode.params, 'resolution')
                    ? sourceNode.params.resolution
                    : sourceConfig.defaults.resolution,
                axis: validateAxis(axisNode.params && axisNode.params.axis)
            },
            options: {
                source: Object.keys(SOURCE_CONFIG),
                sample_rate_hz: sourceConfig.sample_rate_hz.slice(),
                resolution: sourceConfig.resolution.slice(),
                axis: AXIS_OPTIONS.slice()
            },
            outputRef: `${axisNode.node_id}.primary`,
            axis: validateAxis(axisNode.params && axisNode.params.axis),
            hiddenNodeIds: [sourceNode.node_id, axisNode.node_id],
            sourceRef: `${sourceNode.node_id}.primary`,
            axisRef: `${axisNode.node_id}.source`,
            sourceConfig
        };
    }

    function resolveSourceBlockId(partialSelection, currentBlockId) {
        if (partialSelection && typeof partialSelection.source === 'string') {
            return partialSelection.source;
        }

        if (partialSelection && typeof partialSelection.source_block_id === 'string') {
            return partialSelection.source_block_id;
        }

        if (partialSelection && typeof partialSelection.sourceBlockId === 'string') {
            return partialSelection.sourceBlockId;
        }

        if (partialSelection && typeof partialSelection.block_id === 'string') {
            return partialSelection.block_id;
        }

        if (partialSelection && typeof partialSelection.blockId === 'string') {
            return partialSelection.blockId;
        }

        return currentBlockId;
    }

    function resolveAxis(partialSelection, currentAxis) {
        const requestedAxis = partialSelection && typeof partialSelection.axis === 'string'
            ? partialSelection.axis
            : currentAxis;

        if (AXIS_OPTIONS.includes(requestedAxis)) {
            return requestedAxis;
        }

        return AXIS_OPTIONS.includes(currentAxis) ? currentAxis : 'z';
    }

    function applyManagedSourceSelection(graph, partialSelection = {}) {
        const state = normalizeGraph(graph);
        const inspection = inspectManagedSourceGraph(state);
        const nextBlockId = resolveSourceBlockId(partialSelection, inspection.sourceBlockId);
        const nextConfig = SOURCE_CONFIG[nextBlockId];

        if (!nextConfig) {
            throw new Error(`unknown managed source block: ${nextBlockId}`);
        }

        const nextState = createGraphState(state);
        const sourceNode = getNodeById(nextState, inspection.sourceNode.node_id);
        const axisNode = getNodeById(nextState, inspection.axisNode.node_id);

        if (!sourceNode || !axisNode) {
            throw new Error('managed source graph is missing required hidden nodes');
        }

        const currentSourceRate = sourceNode.params && Object.prototype.hasOwnProperty.call(sourceNode.params, 'sample_rate_hz')
            ? sourceNode.params.sample_rate_hz
            : nextConfig.defaults.sample_rate_hz;
        const currentSourceResolution = sourceNode.params && Object.prototype.hasOwnProperty.call(sourceNode.params, 'resolution')
            ? sourceNode.params.resolution
            : nextConfig.defaults.resolution;
        const requestedSampleRate = Object.prototype.hasOwnProperty.call(partialSelection, 'sample_rate_hz')
            ? partialSelection.sample_rate_hz
            : (Object.prototype.hasOwnProperty.call(partialSelection, 'sampleRateHz')
                ? partialSelection.sampleRateHz
                : currentSourceRate);
        const requestedResolution = Object.prototype.hasOwnProperty.call(partialSelection, 'resolution')
            ? partialSelection.resolution
            : currentSourceResolution;

        sourceNode.block_id = nextBlockId;
        sourceNode.params = {
            ...(sourceNode.params && typeof sourceNode.params === 'object' ? sourceNode.params : {}),
            sample_rate_hz: validateScalarOption(
                requestedSampleRate,
                nextConfig.sample_rate_hz,
                nextConfig.defaults.sample_rate_hz
            ),
            resolution: validateScalarOption(
                requestedResolution,
                nextConfig.resolution,
                nextConfig.defaults.resolution
            )
        };

        axisNode.params = {
            ...(axisNode.params && typeof axisNode.params === 'object' ? axisNode.params : {}),
            axis: resolveAxis(partialSelection, axisNode.params && axisNode.params.axis)
        };

        return nextState;
    }

    function resetManagedSourceGraph(graph) {
        const state = normalizeGraph(graph);
        const strippedNodeIds = new Set(
            state.nodes
                .filter(node => node && isManagedResetBlock(node.block_id))
                .map(node => node.node_id)
        );
        const seriesProducerNodeIds = new Set(
            state.nodes
                .filter(node => node && isManagedRepresentationBlock(node.block_id))
                .map(node => node.node_id)
        );
        const preservedNodes = state.nodes.filter(node => !strippedNodeIds.has(node.node_id));
        const preservedConnections = [];
        const remappedConnections = [];
        const remappedConnectionKeys = new Set();

        for (const connection of state.connections) {
            const source = splitRef(connection.source);
            const target = splitRef(connection.target);
            const sourceStripped = strippedNodeIds.has(source.node_id);
            const targetStripped = strippedNodeIds.has(target.node_id);

            if (!sourceStripped && !targetStripped) {
                preservedConnections.push(cloneValue(connection));
                continue;
            }

            if (!seriesProducerNodeIds.has(source.node_id) || targetStripped) {
                continue;
            }

            const targetSocket = Number.isInteger(connection.target_socket) ? connection.target_socket : 0;
            const dedupeKey = `${connection.target}|${targetSocket}`;

            if (remappedConnectionKeys.has(dedupeKey)) {
                continue;
            }

            remappedConnectionKeys.add(dedupeKey);
            remappedConnections.push({
                ...cloneValue(connection),
                source: 'managed-axis.primary',
                source_socket: remappedConnections.length
            });
        }

        const nextOutputs = cloneValue(state.outputs || {});
        for (const [binding, sourceRef] of Object.entries(nextOutputs)) {
            const source = splitRef(sourceRef);

            if (!strippedNodeIds.has(source.node_id)) {
                continue;
            }

            if (seriesProducerNodeIds.has(source.node_id)) {
                nextOutputs[binding] = 'managed-axis.primary';
                continue;
            }

            delete nextOutputs[binding];
        }

        const nextUi = cloneValue(state.ui || {});
        if (nextUi.output_bindings && typeof nextUi.output_bindings === 'object') {
            for (const [binding, meta] of Object.entries(nextUi.output_bindings)) {
                const sourceRef = nextOutputs[binding];

                if (sourceRef === 'managed-axis.primary') {
                    nextUi.output_bindings[binding] = {
                        ...(meta && typeof meta === 'object' ? meta : {}),
                        source_socket: 0
                    };
                    continue;
                }

                if (!Object.prototype.hasOwnProperty.call(nextOutputs, binding)) {
                    delete nextUi.output_bindings[binding];
                }
            }
        }

        const sourceNode = createDefaultSourceNode();
        const axisNode = createDefaultAxisNode();

        return createGraphState({
            ...state,
            nodes: [sourceNode, axisNode].concat(preservedNodes),
            connections: [
                {
                    source: `${sourceNode.node_id}.primary`,
                    target: `${axisNode.node_id}.source`
                }
            ].concat(preservedConnections, remappedConnections),
            outputs: nextOutputs,
            ui: nextUi
        });
    }

    function getHiddenPaletteBlockIds() {
        return HIDDEN_PALETTE_BLOCK_IDS.slice();
    }

    return {
        SOURCE_CONFIG,
        AXIS_OPTIONS,
        ensureManagedSourceGraph,
        inspectManagedSourceGraph,
        applyManagedSourceSelection,
        resetManagedSourceGraph,
        getHiddenPaletteBlockIds
    };
}));
