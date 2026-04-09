const assert = require('node:assert/strict');
const fs = require('node:fs');

const workerSource = fs.readFileSync('flow-builder/src/flow-runtime-worker.js', 'utf8');

assert.match(workerSource, /importScripts\('\.\.\/assets\/flow-runtime\.js'\);/);
assert.match(workerSource, /self\.createFlowRuntimeModule\(\s*\{/);
assert.match(workerSource, /locateFile\s*\(\s*path\s*\)\s*\{/);
assert.match(workerSource, /path\.endsWith\('\.wasm'\)\s*\?\s*`\.\.\/assets\/\$\{path\}`\s*:\s*path/);
