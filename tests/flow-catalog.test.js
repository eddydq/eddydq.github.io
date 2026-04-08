const assert = require('node:assert/strict');
const fs = require('node:fs');

const { normalizeCatalog } = require('../flow-catalog.js');

const catalog = JSON.parse(fs.readFileSync('assets/flow-block-catalog.json', 'utf8'));
const normalized = normalizeCatalog(catalog);

assert.ok(normalized.byId['representation.select_axis']);
assert.ok(normalized.byId['estimation.autocorrelation']);
assert.equal(normalized.byKind.series.colorClass, 'port-kind-series');
assert.equal(normalized.byId['validation.spm_range_gate'].outputs[0].name, 'accepted');
