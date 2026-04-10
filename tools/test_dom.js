const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html);

global.window = dom.window;
global.document = dom.window.document;
global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
};

const scriptCode = fs.readFileSync('script.js', 'utf8');
const simpleFlowchartCode = fs.readFileSync('simple-flowchart.js', 'utf8');

eval(simpleFlowchartCode);
eval(scriptCode);

const track = document.getElementById('simple-flow-track');
console.log('Track innerHTML length:', track.innerHTML.length);
if (track.innerHTML.length === 0) {
    console.error('Track is empty!');
} else {
    console.log('Track rendered successfully.');
}
