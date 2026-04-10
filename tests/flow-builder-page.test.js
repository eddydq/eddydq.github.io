const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const htmlPath = path.join(rootDir, 'flow-builder', 'index.html');
const cssPath = path.join(rootDir, 'flow-builder', 'flow.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

function assertNoMergeMarkers(source, label) {
    assert.equal(
        /<<<<<<<|=======|>>>>>>>/.test(source),
        false,
        `${label} should not contain unresolved git merge markers`
    );
}

assertNoMergeMarkers(html, 'flow-builder/index.html');
assertNoMergeMarkers(css, 'flow-builder/flow.css');

assert.match(html, /<link rel="stylesheet" href="\.\.\/css\/styles\.css"/);
assert.match(html, /<script src="\.\.\/js\/script\.js"><\/script>/);
assert.doesNotMatch(html, /assets\/flow-block-catalog\.js/);

assert.match(html, /class="sidebar-panel"/);
assert.match(html, /class="sidebar-panel-content"/);
assert.match(html, /class="console-pane bottom-console"/);
assert.doesNotMatch(html, /class="right-console"/);

assert.match(css, /\.bottom-console\s*\{/);
assert.match(css, /\.bottom-console\.is-collapsed\s*\{/);
assert.match(css, /\.sidebar\.is-collapsed \.sidebar-panel-content\s*\{/);
assert.match(css, /\.panel-dock-console\s*\{/);
assert.doesNotMatch(css, /\.right-console\s*\{/);
