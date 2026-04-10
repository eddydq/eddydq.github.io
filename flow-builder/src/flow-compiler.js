(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowCompiler = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const PP_MAGIC = 0x5050;
    const PP_VERSION = 1;
    const HEADER_SIZE = 12;
    const FIRMWARE_MAX_NODES = 16;
    const FIRMWARE_MAX_EDGES = 20;

    const BLOCK_IDS = {
        'source.lis3dh': 0x01,
        'source.mpu6050': 0x02,
        'source.polar': 0x03,
        'representation.select_axis': 0x04,
        'representation.vector_magnitude': 0x05,
        'pretraitement.hpf_gravity': 0x06,
        'pretraitement.lowpass': 0x07,
        'estimation.autocorrelation': 0x08,
        'estimation.fft_dominant': 0x09,
        'detection.adaptive_peak_detect': 0x0A,
        'detection.zero_crossing_detect': 0x0B,
        'validation.spm_range_gate': 0x0C,
        'validation.peak_selector': 0x0D,
        'validation.confidence_gate': 0x0E,
        'suivi.kalman_2d': 0x0F,
        'suivi.confirmation_filter': 0x10
    };

    const BLOCK_ALIASES = {
        lis3dh_source: 'source.lis3dh',
        mpu6050_source: 'source.mpu6050',
        polar_source: 'source.polar',
        select_axis: 'representation.select_axis',
        vector_magnitude: 'representation.vector_magnitude',
        hpf_gravity: 'pretraitement.hpf_gravity',
        lowpass: 'pretraitement.lowpass',
        autocorrelation: 'estimation.autocorrelation',
        fft_dominant: 'estimation.fft_dominant',
        adaptive_peak_detect: 'detection.adaptive_peak_detect',
        zero_crossing_detect: 'detection.zero_crossing_detect',
        spm_range_gate: 'validation.spm_range_gate',
        peak_selector: 'validation.peak_selector',
        confidence_gate: 'validation.confidence_gate',
        kalman_2d: 'suivi.kalman_2d',
        confirmation_filter: 'suivi.confirmation_filter'
    };

    const AXIS_IDS = { x: 0, y: 1, z: 2, mag: 3 };
    const PORT_INDEX = {
        source: 0,
        primary: 0,
        candidate: 0,
        series: 1,
        accepted: 0,
        rejected: 1,
        final: 0
    };

    function clampByte(value, fallback = 0) {
        const number = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
        return Math.max(0, Math.min(255, number));
    }

    function clampInt16(value, fallback = 0) {
        const number = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
        return Math.max(-32768, Math.min(32767, number));
    }

    function clampUint16(value, fallback = 0) {
        const number = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
        return Math.max(0, Math.min(65535, number));
    }

    function u16(value) {
        const next = clampUint16(value);
        return [next & 0xFF, next >> 8];
    }

    function i16(value) {
        const next = clampInt16(value);
        const unsigned = next < 0 ? 0x10000 + next : next;
        return [unsigned & 0xFF, unsigned >> 8];
    }

    function normalizeBlockName(blockId) {
        const value = String(blockId || '');
        if (BLOCK_IDS[value]) {
            return value;
        }
        return BLOCK_ALIASES[value] || value;
    }

    function blockIdToByte(blockId) {
        const key = normalizeBlockName(blockId);
        const value = BLOCK_IDS[key];
        if (!value) {
            throw new Error(`unknown block id: ${blockId}`);
        }
        return value;
    }

    function encodeAxis(value) {
        if (typeof value === 'number') {
            return clampByte(value);
        }
        const key = String(value || 'z').toLowerCase();
        return Object.prototype.hasOwnProperty.call(AXIS_IDS, key) ? AXIS_IDS[key] : AXIS_IDS.z;
    }

    function encodeParams(blockId, params = {}) {
        const key = normalizeBlockName(blockId);

        switch (key) {
        case 'lis3dh_source':
        case 'source.lis3dh':
            return [...u16(params.sample_rate_hz ?? params.sampleRateHz ?? 100)];
        case 'mpu6050_source':
        case 'source.mpu6050':
            return [...u16(params.sample_rate_hz ?? params.sampleRateHz ?? 100)];
        case 'polar_source':
        case 'source.polar':
            return [...u16(params.sample_rate_hz ?? params.sampleRateHz ?? 52)];
        case 'select_axis':
        case 'representation.select_axis':
            return [encodeAxis(params.axis)];
        case 'vector_magnitude':
        case 'representation.vector_magnitude':
            return [];
        case 'hpf_gravity':
        case 'pretraitement.hpf_gravity':
        case 'lowpass':
        case 'pretraitement.lowpass':
            return [clampByte(params.cutoff_hz ?? params.cutoffHz ?? 1), clampByte(params.order ?? 1)];
        case 'autocorrelation':
        case 'estimation.autocorrelation':
            return [
                ...u16(params.min_lag ?? params.min_lag_samples ?? 15),
                ...u16(params.max_lag ?? params.max_lag_samples ?? 160),
                clampByte(params.confidence_min ?? 0),
                clampByte(params.harmonic_pct ?? 80)
            ];
        case 'fft_dominant':
        case 'estimation.fft_dominant':
            return [
                clampByte(params.min_hz ?? params.minHz ?? 0),
                clampByte(params.max_hz ?? params.maxHz ?? 5),
                clampByte(params.window_type ?? params.windowType ?? 0)
            ];
        case 'adaptive_peak_detect':
        case 'detection.adaptive_peak_detect':
            return [
                clampByte(params.threshold_factor ?? 8),
                ...u16(params.min_distance ?? params.min_distance_samples ?? 5),
                clampByte(params.decay_rate ?? 200)
            ];
        case 'zero_crossing_detect':
        case 'detection.zero_crossing_detect':
            return [
                ...i16(params.hysteresis ?? 50),
                ...u16(params.min_interval ?? params.min_interval_samples ?? 5)
            ];
        case 'spm_range_gate':
        case 'validation.spm_range_gate':
            return [clampByte(params.min_spm ?? 30), clampByte(params.max_spm ?? 200)];
        case 'peak_selector':
        case 'validation.peak_selector':
            return [...i16(params.min_prominence ?? 0), ...u16(params.min_distance ?? 1)];
        case 'confidence_gate':
        case 'validation.confidence_gate':
            return [clampByte(params.min_confidence ?? 0), ...i16(params.fallback_value ?? 0)];
        case 'kalman_2d':
        case 'suivi.kalman_2d':
            return [
                ...u16(params.q ?? 256),
                ...u16(params.r ?? 256),
                ...u16(params.p_max ?? 10000),
                clampByte(params.max_jump ?? 20)
            ];
        case 'confirmation_filter':
        case 'suivi.confirmation_filter':
            return [clampByte(params.required_count ?? 3), clampByte(params.tolerance_pct ?? 10)];
        default:
            return [];
        }
    }

    function splitRef(ref) {
        const value = String(ref || '');
        const dotIndex = value.indexOf('.');
        if (dotIndex === -1) {
            return { nodeId: value, port: 'primary' };
        }
        return { nodeId: value.slice(0, dotIndex), port: value.slice(dotIndex + 1) };
    }

    function resolvePortIndex(refPort, socketIndex) {
        if (refPort && Object.prototype.hasOwnProperty.call(PORT_INDEX, refPort)) {
            return PORT_INDEX[refPort];
        }

        return Number.isInteger(socketIndex) ? socketIndex : 0;
    }

    const SOURCE_BLOCK_IDS = new Set(['source.lis3dh', 'source.mpu6050', 'source.polar']);

    function injectAxisBlocks(graph) {
        const nodes = graph.nodes.slice();
        const edges = graph.edges.slice();
        const injected = new Map();

        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (!SOURCE_BLOCK_IDS.has(normalizeBlockName(node.blockId))) {
                continue;
            }

            const axis = String(node.params.axis || 'z').toLowerCase();
            const isMagnitude = axis === 'magnitude' || axis === 'mag';
            const injectedIndex = nodes.length;
            const injectedBlockId = isMagnitude
                ? 'representation.vector_magnitude'
                : 'representation.select_axis';
            const injectedParams = isMagnitude ? {} : { axis: axis };

            nodes.push({
                source: null,
                index: injectedIndex,
                nodeId: `__axis_${node.nodeId}`,
                blockId: injectedBlockId,
                params: injectedParams
            });

            for (const edge of edges) {
                if (edge.src === node.index) {
                    edge.src = injectedIndex;
                }
            }

            edges.push({
                src: node.index,
                srcPort: 0,
                dst: injectedIndex,
                dstPort: 0
            });

            injected.set(node.index, injectedIndex);
        }

        for (let i = 0; i < nodes.length; i++) {
            nodes[i].index = i;
        }

        return { nodes, edges };
    }

    function normalizeGraph(graph) {
        const nodes = (graph.nodes || []).map((node, index) => ({
            source: node,
            index,
            nodeId: String(node.node_id ?? node.id ?? index),
            blockId: node.block_id ?? node.blockId,
            params: node.params || {}
        }));
        const nodeIndexById = new Map(nodes.map(node => [node.nodeId, node.index]));
        const edges = [];

        if (Array.isArray(graph.edges)) {
            for (const edge of graph.edges) {
                edges.push({
                    src: clampByte(edge.src),
                    srcPort: clampByte(edge.srcPort ?? edge.src_port ?? 0),
                    dst: clampByte(edge.dst),
                    dstPort: clampByte(edge.dstPort ?? edge.dst_port ?? 0)
                });
            }
        }

        if (Array.isArray(graph.connections)) {
            for (const connection of graph.connections) {
                const source = splitRef(connection.source);
                const target = splitRef(connection.target);
                if (source.nodeId === 'input' || target.nodeId === 'output') {
                    continue;
                }
                if (!nodeIndexById.has(source.nodeId) || !nodeIndexById.has(target.nodeId)) {
                    continue;
                }
                edges.push({
                    src: nodeIndexById.get(source.nodeId),
                    srcPort: resolvePortIndex(source.port, connection.source_socket),
                    dst: nodeIndexById.get(target.nodeId),
                    dstPort: resolvePortIndex(target.port, connection.target_socket)
                });
            }
        }

        return injectAxisBlocks({ nodes, edges });
    }

    function crc16(data) {
        let crc = 0xFFFF;
        for (const byte of data) {
            crc ^= byte << 8;
            for (let bit = 0; bit < 8; bit += 1) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
                crc &= 0xFFFF;
            }
        }
        return crc;
    }

    function pushTlv(body, tag, value) {
        if (value.length > 255) {
            throw new Error(`TLV too large for tag 0x${tag.toString(16)}`);
        }
        body.push(tag, value.length, ...value);
    }

    function compileGraph(graphJson) {
        const graph = normalizeGraph(graphJson || {});
        const body = [];

        if (graph.nodes.length > 255 || graph.edges.length > 255) {
            throw new Error('graph is too large for protocol header');
        }

        if (graph.nodes.length > FIRMWARE_MAX_NODES) {
            throw new Error(`firmware graph capacity exceeded: max nodes ${FIRMWARE_MAX_NODES}`);
        }

        if (graph.edges.length > FIRMWARE_MAX_EDGES) {
            throw new Error(`firmware graph capacity exceeded: max edges ${FIRMWARE_MAX_EDGES}`);
        }

        for (const node of graph.nodes) {
            const params = encodeParams(node.blockId, node.params);
            pushTlv(body, 0x01, [
                blockIdToByte(node.blockId),
                node.index,
                params.length,
                ...params
            ]);
        }

        for (const edge of graph.edges) {
            pushTlv(body, 0x02, [
                clampByte(edge.src),
                clampByte(edge.srcPort),
                clampByte(edge.dst),
                clampByte(edge.dstPort)
            ]);
        }

        const bodyLength = body.length;
        if (bodyLength > 65535) {
            throw new Error('compiled graph body exceeds protocol limit');
        }

        const output = new Uint8Array(HEADER_SIZE + bodyLength);
        const view = new DataView(output.buffer);
        view.setUint16(0, PP_MAGIC, true);
        view.setUint8(2, PP_VERSION);
        view.setUint8(3, graph.nodes.length);
        view.setUint8(4, graph.edges.length);
        view.setUint8(5, 0);
        view.setUint16(6, bodyLength, true);
        output.set(body, HEADER_SIZE);
        view.setUint16(8, crc16(output.slice(HEADER_SIZE)), true);
        view.setUint16(10, 0, true);

        return output;
    }

    return {
        PP_MAGIC,
        PP_VERSION,
        BLOCK_IDS,
        compileGraph,
        crc16
    };
}));
