const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const flowBuilderDir = path.join(rootDir, 'flow-builder');
const html = fs.readFileSync(path.join(flowBuilderDir, 'index.html'), 'utf8');

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
        dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) {
                handler(event);
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
        ['console-dock-btn', createElement('console-dock-btn')]
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
                return null;
            },
            setItem() {}
        },
        setTimeout(handler) {
            handler();
            return 0;
        },
        clearTimeout() {},
        fetch: async () => {
            throw new Error('fetch blocked');
        }
    };

    context.globalThis = context;
    vm.createContext(context);

    for (const src of flowScriptSrcs) {
        const scriptPath = path.join(flowBuilderDir, src);
        const script = fs.readFileSync(scriptPath, 'utf8');
        vm.runInContext(script, context, { filename: scriptPath });
    }

    const domContentLoadedHandlers = listeners.get('DOMContentLoaded') || [];

    assert.equal(
        domContentLoadedHandlers.length,
        1,
        'flow builder should register one DOMContentLoaded handler'
    );

    await domContentLoadedHandlers[0]();

    assert.equal(
        elements.get('catalog-status').textContent,
        'Catalog ready',
        'catalog should load successfully when fetch is blocked'
    );
    assert.match(
        elements.get('palette-groups').innerHTML,
        /source\.lis3dh/,
        'palette should render at least one catalog block'
    );
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
