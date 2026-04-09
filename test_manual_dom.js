const fs = require('fs');

const simpleFlowchartCode = fs.readFileSync('simple-flowchart.js', 'utf8');
let trackHtml = '';
let rootClassList = new Set();
let trackChildElementCount = 0;

global.document = {
    querySelectorAll: () => [],
    getElementById: (id) => {
        if (id === 'year') return {};
        if (id === 'simple-flowchart') {
            return {
                classList: {
                    toggle: (cls, force) => {
                        if (force) rootClassList.add(cls);
                        else rootClassList.delete(cls);
                    }
                }
            };
        }
        if (id === 'simple-flow-track') {
            return {
                get childElementCount() {
                    return trackChildElementCount;
                },
                set innerHTML(val) {
                    trackHtml = val;
                    trackChildElementCount = val.length > 0 ? 1 : 0;
                },
                get innerHTML() {
                    return trackHtml;
                },
                querySelector: () => ({
                    classList: { toggle: () => {} },
                    setAttribute: () => {}
                }),
                addEventListener: () => {}
            };
        }
        return null;
    },
    addEventListener: () => {}
};

global.window = {
    SimpleFlowchart: undefined
};

global.IntersectionObserver = class { observe() {} unobserve() {} };

eval(simpleFlowchartCode);

// The simpleFlowchartCode uses an IIFE that either attaches to module.exports or to globalThis.SimpleFlowchart
let SimpleFlowchart;
if (typeof module === 'object' && module.exports && module.exports.buildSimpleFlowModel) {
    SimpleFlowchart = module.exports;
} else {
    SimpleFlowchart = global.SimpleFlowchart || globalThis.SimpleFlowchart;
}
global.window.SimpleFlowchart = SimpleFlowchart;

const scriptCode = fs.readFileSync('script.js', 'utf8');
eval(scriptCode);

// After loading, script.js might wait for DOMContentLoaded. We force sync here.
if (typeof syncSimpleFlowchart === 'function') {
    syncSimpleFlowchart();
    console.log('Track HTML length:', trackHtml.length);
    if (trackHtml.length === 0) {
        console.error('TRACK IS STILL EMPTY');
    } else {
        console.log('Track rendered with HTML:', trackHtml.substring(0, 100) + '...');
    }
} else {
    console.error('syncSimpleFlowchart not found');
}
