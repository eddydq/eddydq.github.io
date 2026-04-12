const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.join(rootDir, 'serve.ps1');

assert.ok(fs.existsSync(scriptPath), 'serve.ps1 should exist at the repo root');

const script = fs.readFileSync(scriptPath, 'utf8');

assert.match(script, /\[int\]\$Port = 8000/);
assert.match(script, /\[string\]\$OpenPath = 'flow-builder\/'/);
assert.match(script, /\[string\]\$Watch = 'flow-builder,css,js'/);
assert.match(script, /\[switch\]\$DryRun/);
assert.match(script, /\$RepoRoot = Resolve-Path \$PSScriptRoot/);
assert.match(script, /Get-Command npx\.cmd, npx/);
assert.match(script, /'live-server'/);
assert.match(script, /"--port=\$Port"/);
assert.match(script, /"--open=\$OpenPath"/);
assert.match(script, /"--watch=\$Watch"/);
assert.match(script, /& \$\(\$npx\.Path\) @Arguments/);
assert.match(script, /command = \$npx\.Name/);
assert.match(script, /ConvertTo-Json -Compress/);
