const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const flowBuilderDir = path.join(rootDir, 'flow-builder');
const html = fs.readFileSync(path.join(flowBuilderDir, 'index.html'), 'utf8');
const storedGraph = JSON.stringify({
    schema_version: 2,
    nodes: [
        {
            node_id: 'src',
            block_id: 'source.polar',
            params: { sample_rate_hz: 52 },
            ui: { position: { x: 140, y: 120 } }
        },
        {
            node_id: 'axis',
            block_id: 'representation.select_axis',
            params: { axis: 'z' },
            ui: { position: { x: 360, y: 120 } }
        },
        {
            node_id: 'ac',
            block_id: 'estimation.autocorrelation',
            params: { min_lag: 15, max_lag: 104, confidence_min: 0, harmonic_pct: 80 },
            ui: { position: { x: 580, y: 120 } }
        }
    ],
    connections: [
        { source: 'src.primary', source_socket: 0, target: 'axis.source', target_socket: 0 },
        { source: 'axis.primary', source_socket: 0, target: 'ac.source', target_socket: 0 }
    ],
    outputs: { cadence: 'ac.primary' }
});

function extractScriptSrcs(source) {
    return Array.from(source.matchAll(/<script\s+src="([^"]+)"><\/script>/g), match => match[1]);
}

function createClassList() {
    const classes = new Set();

    return {
        add(...tokens) {
            for (const token of tokens) {
                classes.add(token);
            }
        },
        remove(...tokens) {
            for (const token of tokens) {
                classes.delete(token);
            }
        },
        contains(token) {
            return classes.has(token);
        },
        toggle(token) {
            if (classes.has(token)) {
                classes.delete(token);
                return false;
            }

            classes.add(token);
            return true;
        }
    };
}

function createElement(id = '') {
    const listeners = new Map();
    const attributes = new Map();

    return {
        id,
        dataset: {},
        style: {},
        value: 0,
        disabled: false,
        innerHTML: '',
        textContent: '',
        clientWidth: 1280,
        clientHeight: 720,
        offsetWidth: 260,
        offsetHeight: 180,
        classList: createClassList(),
        addEventListener(type, handler) {
            if (!listeners.has(type)) {
                listeners.set(type, []);
            }

            listeners.get(type).push(handler);
        },
        async dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) {
                await handler(event);
            }
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        },
        closest() {
            return null;
        },
        appendChild() {},
        setAttribute(name, value) {
            attributes.set(name, value);
        },
        getAttribute(name) {
            return attributes.has(name) ? attributes.get(name) : null;
        },
        getBoundingClientRect() {
            return {
                left: 0,
                top: 0,
                width: this.clientWidth || 0,
                height: this.clientHeight || 0
            };
        }
    };
}

function createTestDocument() {
    const listeners = new Map();
    const elements = new Map([
        ['palette-groups', createElement('palette-groups')],
        ['blocks-layer', createElement('blocks-layer')],
        ['wires-layer', createElement('wires-layer')],
        ['graph-output-list', createElement('graph-output-list')],
        ['runtime-diagnostics', createElement('runtime-diagnostics')],
        ['catalog-status', createElement('catalog-status')],
        ['run-sim-btn', createElement('run-sim-btn')],
        ['upload-pipeline-btn', createElement('upload-pipeline-btn')],
        ['upload-progress', createElement('upload-progress')],
        ['upload-status', createElement('upload-status')],
        ['canvas', createElement('canvas')],
        ['dsp-sidebar', createElement('dsp-sidebar')],
        ['execution-console', createElement('execution-console')],
        ['sidebar-dock-btn', createElement('sidebar-dock-btn')],
        ['console-dock-btn', createElement('console-dock-btn')],
        ['cadence-chart', createElement('cadence-chart')],
        ['replay-status', createElement('replay-status')]
    ]);

    return {
        document: {
            getElementById(id) {
                return elements.get(id) || null;
            },
            addEventListener(type, handler) {
                if (!listeners.has(type)) {
                    listeners.set(type, []);
                }

                listeners.get(type).push(handler);
            },
            createElementNS() {
                return createElement();
            }
        },
        elements,
        listeners
    };
}

async function main() {
    const scriptSrcs = extractScriptSrcs(html);
    const flowScriptSrcs = scriptSrcs.filter(src => src === 'assets/flow-block-catalog.js' || src.startsWith('src/'));
    const { document, elements, listeners } = createTestDocument();

    const context = {
        console,
        document,
        window: {
            addEventListener() {}
        },
        localStorage: {
            getItem() {
                return storedGraph;
            },
            setItem() {}
        },
        setTimeout(handler) {
            handler();
            return 0;
        },
        clearTimeout() {},
        fetch: async (url) => {
            const csv = [
                'timestamp,count,x_000,y_000,z_000',
                '1000,1,11,21,31'
            ].join('\n');

            if (String(url).includes('polar_log_002.csv')) {
                return {
                    ok: true,
                    text: async () => csv
                };
            }

            throw new Error(`unexpected fetch: ${url}`);
        }
    };

    context.globalThis = context;
    vm.createContext(context);

    for (const src of flowScriptSrcs) {
        const scriptPath = path.join(flowBuilderDir, src);
        const script = fs.readFileSync(scriptPath, 'utf8');
        vm.runInContext(script, context, { filename: scriptPath });
    }

    context.FlowReplay = {
        ...context.FlowReplay,
        async runReplaySession() {
            return {
                series: [{ timestamp: 1000, cadence: 68 }],
                emptySeriesReason: null,
                lastStepResult: {
                    outputs: {
                        cadence: {
                            kind: 'candidate',
                            length: 2,
                            values: [68, 80]
                        }
                    },
                    diagnostics: { nodes: [{ node_id: 'ac', status: 'ok' }] }
                }
            };
        }
    };

    context.FlowRuntimeClient = {
        createFlowRuntimeClient() {
            return {
                async runGraph() {
                    throw new Error('runtime should not be called directly in this test');
                }
            };
        }
    };

    const domContentLoadedHandlers = listeners.get('DOMContentLoaded') || [];

    assert.equal(domContentLoadedHandlers.length, 1);

    await domContentLoadedHandlers[0]();
    await elements.get('run-sim-btn').dispatchEvent({ type: 'click' });

    assert.match(elements.get('cadence-chart').innerHTML, /svg/i);
    assert.match(elements.get('replay-status').textContent, /1 cadence points/i);
    assert.match(elements.get('graph-output-list').textContent, /"candidate"/);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
