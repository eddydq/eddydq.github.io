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
            node_id: 'src-a',
            block_id: 'source.polar',
            params: { sample_rate_hz: 52, resolution: 16 }
        },
        {
            node_id: 'src-b',
            block_id: 'source.lis3dh',
            params: { sample_rate_hz: 100, resolution: 12 }
        },
        {
            node_id: 'axis',
            block_id: 'representation.select_axis',
            params: { axis: 'z' }
        }
    ],
    connections: [
        { source: 'src-a.primary', target: 'axis.source' },
        { source: 'src-b.primary', target: 'axis.source' }
    ],
    outputs: { cadence: 'axis.primary' }
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
        fetch: async () => ({
            ok: true,
            text: async () => [
                'timestamp,count,x_000,y_000,z_000',
                '2026-04-06T12:31:05.476,1,11,21,31'
            ].join('\n')
        })
    };

    context.globalThis = context;
    vm.createContext(context);

    for (const src of flowScriptSrcs) {
        const scriptPath = path.join(flowBuilderDir, src);
        const script = fs.readFileSync(scriptPath, 'utf8');
        vm.runInContext(script, context, { filename: scriptPath });
    }

    const domContentLoadedHandlers = listeners.get('DOMContentLoaded') || [];
    assert.equal(domContentLoadedHandlers.length, 1);

    await domContentLoadedHandlers[0]();

    assert.match(elements.get('catalog-status').textContent, /managed source/i);
    assert.match(elements.get('blocks-layer').innerHTML, /Managed source graph/i);
    assert.match(elements.get('blocks-layer').innerHTML, /system-block-source/);
    assert.match(elements.get('blocks-layer').innerHTML, /system-block-output/);
    assert.equal(elements.get('palette-groups').innerHTML, '');
    assert.match(elements.get('runtime-diagnostics').textContent, /exactly one source/i);
    assert.equal(elements.get('run-sim-btn').disabled, true);
    assert.equal(elements.get('upload-pipeline-btn').disabled, true);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
