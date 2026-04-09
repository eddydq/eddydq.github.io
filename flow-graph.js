(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowGraph = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SCHEMA_VERSION = 2;
    const PACKET_KIND_COLORS = {
        raw_window: 'port-kind-raw-window',
        series: 'port-kind-series',
        candidate: 'port-kind-candidate',
        estimate: 'port-kind-estimate'
    };
    const SYSTEM_INPUT_KINDS = {
        raw: 'raw_window',
        series: 'series',
        candidate: 'candidate',
        estimate: 'estimate'
    };

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(cloneValue);
        }

        if (isPlainObject(value)) {
            const copy = {};

            for (const [key, entry] of Object.entries(value)) {
                copy[key] = cloneValue(entry);
            }

            return copy;
        }

        return value;
    }

    function createGraphState(overrides = {}) {
        return {
            schema_version: SCHEMA_VERSION,
            nodes: Array.isArray(overrides.nodes) ? overrides.nodes.map(cloneValue) : [],
            connections: Array.isArray(overrides.connections) ? overrides.connections.map(cloneValue) : [],
            outputs: isPlainObject(overrides.outputs) ? cloneValue(overrides.outputs) : {}
        };
    }

    function serializeGraph(state) {
        return createGraphState(state);
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

    function buildNodeMap(graph) {
        return new Map(graph.nodes.map(node => [node.node_id, node]));
    }

    function normalizeCatalog(catalog) {
        if (!catalog) {
            return {};
        }

        if (catalog.byId && typeof catalog.byId === 'object') {
            return catalog.byId;
        }

        return catalog;
    }

    function getInputPorts(manifest) {
        if (Array.isArray(manifest && manifest.input_ports)) {
            return manifest.input_ports;
        }

        if (Array.isArray(manifest && manifest.inputs)) {
            return manifest.inputs;
        }

        return [];
    }

    function getInputPort(manifest, name) {
        return getInputPorts(manifest).find(port => port.name === name) || null;
    }

    function getOutputPorts(manifest) {
        if (Array.isArray(manifest && manifest.output_ports)) {
            return manifest.output_ports;
        }

        if (Array.isArray(manifest && manifest.outputs)) {
            return manifest.outputs;
        }

        return [];
    }

    function getOutputPort(manifest, name) {
        return getOutputPorts(manifest).find(port => port.name === name) || null;
    }

    function getSystemInputKinds(catalog) {
        if (catalog && catalog.system_inputs && typeof catalog.system_inputs === 'object') {
            return catalog.system_inputs;
        }

        if (catalog && catalog.systemInputs && typeof catalog.systemInputs === 'object') {
            return catalog.systemInputs;
        }

        return SYSTEM_INPUT_KINDS;
    }

    function topologicallySortGraph(graph) {
        const state = createGraphState(graph);
        const nodeMap = buildNodeMap(state);
        const indegree = new Map(state.nodes.map(node => [node.node_id, 0]));
        const outgoing = new Map(state.nodes.map(node => [node.node_id, []]));

        for (const edge of state.connections) {
            const sourceRef = splitRef(edge.source);
            const targetRef = splitRef(edge.target);

            if (sourceRef.node_id === 'input') {
                continue;
            }

            if (!nodeMap.has(sourceRef.node_id) || !nodeMap.has(targetRef.node_id)) {
                continue;
            }

            indegree.set(targetRef.node_id, indegree.get(targetRef.node_id) + 1);
            outgoing.get(sourceRef.node_id).push(targetRef.node_id);
        }

        const queue = state.nodes
            .map(node => node.node_id)
            .filter(node_id => indegree.get(node_id) === 0);
        const ordered = [];

        while (queue.length > 0) {
            const node_id = queue.shift();
            ordered.push(node_id);

            for (const nextNodeId of outgoing.get(node_id) || []) {
                indegree.set(nextNodeId, indegree.get(nextNodeId) - 1);
                if (indegree.get(nextNodeId) === 0) {
                    queue.push(nextNodeId);
                }
            }
        }

        if (ordered.length !== state.nodes.length) {
            throw new Error('cycle detected in graph connections');
        }

        return ordered;
    }

    function validateGraph(graph, catalog) {
        const state = createGraphState(graph);
        const catalogById = normalizeCatalog(catalog);
        const systemInputKinds = getSystemInputKinds(catalog);
        const nodeMap = buildNodeMap(state);
        const incomingCounts = new Map();
        const errors = [];

        if (!graph || graph.schema_version !== SCHEMA_VERSION) {
            errors.push(`unsupported schema version: ${graph && graph.schema_version}`);
        }

        for (const node of state.nodes) {
            if (nodeMap.get(node.node_id) !== node) {
                errors.push(`duplicate node id: ${node.node_id}`);
                continue;
            }

            if (!catalogById[node.block_id]) {
                errors.push(`unknown block id: ${node.block_id}`);
            }
        }

        for (const edge of state.connections) {
            const sourceRef = splitRef(edge.source);
            const targetRef = splitRef(edge.target);
            const targetNode = nodeMap.get(targetRef.node_id);

            if (!targetNode) {
                errors.push(`unknown target node: ${targetRef.node_id}`);
                continue;
            }

            const targetManifest = catalogById[targetNode.block_id];
            if (!targetManifest) {
                continue;
            }

            const inputPort = getInputPort(targetManifest, targetRef.port);
            if (!inputPort) {
                errors.push(`unknown input port: ${edge.target}`);
                continue;
            }

            const targetKey = `${targetRef.node_id}.${targetRef.port}`;
            const nextCount = (incomingCounts.get(targetKey) || 0) + 1;
            incomingCounts.set(targetKey, nextCount);

            if (inputPort.cardinality === 'one' && nextCount > 1) {
                errors.push(`single-cardinality input already connected: ${targetKey}`);
            }

            if (sourceRef.node_id === 'input') {
                const sourceKind = systemInputKinds[sourceRef.port];
                if (!sourceKind) {
                    errors.push(`unknown system input: ${edge.source}`);
                    continue;
                }

                if (!Array.isArray(inputPort.kinds) || !inputPort.kinds.includes(sourceKind)) {
                    errors.push(`packet kind mismatch: ${edge.source} -> ${edge.target}`);
                }
                continue;
            }

            const sourceNode = nodeMap.get(sourceRef.node_id);
            if (!sourceNode) {
                errors.push(`unknown source node: ${sourceRef.node_id}`);
                continue;
            }

            const sourceManifest = catalogById[sourceNode.block_id];
            if (!sourceManifest) {
                continue;
            }

            const outputPort = getOutputPort(sourceManifest, sourceRef.port);
            if (!outputPort) {
                errors.push(`unknown output port: ${edge.source}`);
                continue;
            }

            if (!Array.isArray(inputPort.kinds) || !inputPort.kinds.includes(outputPort.kind)) {
                errors.push(`packet kind mismatch: ${edge.source} -> ${edge.target}`);
            }
        }

        for (const node of state.nodes) {
            const manifest = catalogById[node.block_id];
            if (!manifest) {
                continue;
            }

            for (const inputPort of getInputPorts(manifest)) {
                if (inputPort.cardinality !== 'one') {
                    continue;
                }

                const targetKey = `${node.node_id}.${inputPort.name}`;
                if (!incomingCounts.has(targetKey)) {
                    errors.push(`missing required input connection: ${targetKey}`);
                }
            }
        }

        for (const [bindingName, sourceRefValue] of Object.entries(state.outputs)) {
            const outputRef = splitRef(sourceRefValue);
            const sourceNode = nodeMap.get(outputRef.node_id);

            if (!sourceNode) {
                errors.push(`unknown output node: ${outputRef.node_id}`);
                continue;
            }

            const sourceManifest = catalogById[sourceNode.block_id];
            if (!sourceManifest) {
                continue;
            }

            if (!getOutputPort(sourceManifest, outputRef.port)) {
                errors.push(`unknown output port for binding ${bindingName}: ${sourceRefValue}`);
            }
        }

        try {
            topologicallySortGraph(state);
        } catch (error) {
            errors.push(error.message);
        }

        return errors;
    }

    return {
        SCHEMA_VERSION,
        PACKET_KIND_COLORS,
        createGraphState,
        serializeGraph,
        validateGraph,
        topologicallySortGraph
    };
}));
