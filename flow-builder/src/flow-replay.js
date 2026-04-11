(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowReplay = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const DEFAULT_REPLAY_SAMPLE_RATE_HZ = 52;

    function parsePolarReplayCsv(csvText) {
        const lines = String(csvText || '').trim().split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) {
            return [];
        }

        const header = lines[0].split(',');
        const xStart = header.indexOf('x_000');
        const yStart = header.indexOf('y_000');
        const zStart = header.indexOf('z_000');

        return lines.slice(1).map(line => {
            const cells = line.split(',');
            const count = Number(cells[1] || 0);

            return {
                timestamp: Number(cells[0] || 0),
                count,
                x: cells.slice(xStart, xStart + count).map(Number),
                y: cells.slice(yStart, yStart + count).map(Number),
                z: cells.slice(zStart, zStart + count).map(Number)
            };
        }).filter(frame => frame.count > 0);
    }

    function buildReplayExecutionGraph(graph) {
        const nodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
        const connections = Array.isArray(graph && graph.connections) ? graph.connections : [];
        const sourceNode = nodes.find(node => node.block_id === 'source.polar');

        if (!sourceNode) {
            throw new Error('replay preview requires one source.polar node');
        }

        return {
            ...graph,
            nodes: nodes.filter(node => node.node_id !== sourceNode.node_id),
            connections: connections
                .filter(connection => !String(connection.target || '').startsWith(`${sourceNode.node_id}.`))
                .map(connection => String(connection.source || '').startsWith(`${sourceNode.node_id}.`)
                    ? { ...connection, source: 'input.raw', source_socket: 0 }
                    : connection)
        };
    }

    function createReplayPacket(frame) {
        return {
            binding_name: 'raw',
            packet: {
                kind: 'raw_window',
                data: {
                    sample_rate_hz: DEFAULT_REPLAY_SAMPLE_RATE_HZ,
                    length: frame.count,
                    x: frame.x.slice(0, frame.count),
                    y: frame.y.slice(0, frame.count),
                    z: frame.z.slice(0, frame.count)
                }
            }
        };
    }

    function collectCadencePoint(timestamp, result, finalBinding) {
        const packet = result && result.outputs ? result.outputs[finalBinding] : null;
        if (
            !packet ||
            (packet.kind !== 'estimate' && packet.kind !== 'candidate') ||
            !Array.isArray(packet.values) ||
            packet.values.length < 1
        ) {
            return null;
        }

        return {
            timestamp,
            cadence: packet.values[0]
        };
    }

    function describeEmptySeries(result, finalBinding) {
        const packet = result && result.outputs ? result.outputs[finalBinding] : null;

        if (!packet) {
            return `Final output "${finalBinding}" was not produced.`;
        }

        if (packet.kind !== 'estimate' && packet.kind !== 'candidate') {
            return `Final output "${finalBinding}" must be candidate or estimate; got ${packet.kind}.`;
        }

        return `Final output "${finalBinding}" produced no cadence values.`;
    }

    async function runReplaySession({ runtime, graph, frames, finalBinding }) {
        if (!runtime || typeof runtime.runGraph !== 'function') {
            throw new Error('replay runtime is unavailable');
        }

        if (!Array.isArray(frames) || frames.length === 0) {
            throw new Error('replay CSV contained no valid rows');
        }

        const replayGraph = buildReplayExecutionGraph(graph || {});
        const series = [];
        let lastStepResult = null;

        for (let index = 0; index < frames.length; index += 1) {
            const frame = frames[index];

            try {
                lastStepResult = await runtime.runGraph({
                    graph: replayGraph,
                    inputs: [createReplayPacket(frame)]
                });
            } catch (error) {
                const message = error && error.message ? error.message : 'replay execution failed';
                throw new Error(`replay row ${index} at ${frame.timestamp} failed: ${message}`);
            }

            const point = collectCadencePoint(frame.timestamp, lastStepResult, finalBinding);
            if (point) {
                series.push(point);
            }
        }

        return {
            series,
            lastStepResult,
            emptySeriesReason: series.length === 0
                ? describeEmptySeries(lastStepResult, finalBinding)
                : null,
            replayMeta: {
                frameCount: frames.length,
                sampleRateHz: DEFAULT_REPLAY_SAMPLE_RATE_HZ
            }
        };
    }

    return {
        DEFAULT_REPLAY_SAMPLE_RATE_HZ,
        parsePolarReplayCsv,
        buildReplayExecutionGraph,
        createReplayPacket,
        collectCadencePoint,
        runReplaySession
    };
}));
