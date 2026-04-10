const assert = require('node:assert/strict');

const { bindPanelDocks } = require('../src/panel-docks.js');

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        toggle(value) {
            if (values.has(value)) {
                values.delete(value);
                return false;
            }

            values.add(value);
            return true;
        },
        contains(value) {
            return values.has(value);
        }
    };
}

function createButton(label) {
    const iconNode = { textContent: '' };
    const textNode = { textContent: label };

    return {
        dataset: {},
        attributes: {},
        listeners: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        addEventListener(type, listener) {
            this.listeners[type] = listener;
        },
        querySelector(selector) {
            if (selector === '.panel-dock-icon') {
                return iconNode;
            }

            if (selector === '.panel-dock-text') {
                return textNode;
            }

            return null;
        },
        click() {
            this.listeners.click?.();
        }
    };
}

const sidebar = { classList: createClassList() };
const consolePane = { classList: createClassList(['is-collapsed']) };
const sidebarDock = createButton('DSP Pipeline');
const consoleDock = createButton('Execution Outputs');

let updateCount = 0;

bindPanelDocks({
    sidebar,
    consolePane,
    sidebarDock,
    consoleDock,
    updateWires() {
        updateCount += 1;
    }
});

assert.equal(sidebarDock.dataset.state, 'expanded');
assert.equal(sidebarDock.attributes['aria-expanded'], 'true');
assert.match(sidebarDock.attributes['aria-label'], /hide dsp pipeline/i);
assert.equal(sidebarDock.querySelector('.panel-dock-icon').textContent, '<');

assert.equal(consoleDock.dataset.state, 'collapsed');
assert.equal(consoleDock.attributes['aria-expanded'], 'false');
assert.match(consoleDock.attributes['aria-label'], /show execution outputs/i);
assert.equal(consoleDock.querySelector('.panel-dock-icon').textContent, '^');

sidebarDock.click();
assert.equal(sidebar.classList.contains('is-collapsed'), true);
assert.equal(sidebarDock.dataset.state, 'collapsed');
assert.equal(sidebarDock.querySelector('.panel-dock-icon').textContent, '>');
assert.equal(updateCount, 1);

consoleDock.click();
assert.equal(consolePane.classList.contains('is-collapsed'), false);
assert.equal(consoleDock.dataset.state, 'expanded');
assert.equal(consoleDock.querySelector('.panel-dock-icon').textContent, 'v');
assert.equal(updateCount, 2);
