const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadCatalog, normalizeCatalog } = require('../flow-builder/src/flow-catalog.js');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flow-builder', 'assets', 'flow-block-catalog.json'), 'utf8'));
const normalized = normalizeCatalog(catalog);

assert.ok(normalized.byId['source.lis3dh']);
assert.ok(normalized.byId['representation.select_axis']);
assert.ok(normalized.byId['representation.vector_magnitude']);
assert.ok(normalized.byId['estimation.autocorrelation']);
assert.equal(normalized.byKind.series.colorClass, 'port-kind-series');
assert.equal(normalized.byKind.raw_window.colorClass, 'port-kind-raw-window');
assert.equal(normalized.byId['source.lis3dh'].outputs[0].kind, 'raw_window');
assert.equal(normalized.byId['validation.spm_range_gate'].outputs[0].name, 'accepted');

async function main() {
    const previousEmbeddedCatalog = globalThis.FLOW_EMBEDDED_CATALOG;

    try {
        globalThis.FLOW_EMBEDDED_CATALOG = catalog;

        const fallbackCatalog = await loadCatalog(async () => {
            throw new Error('fetch blocked');
        });

        assert.ok(fallbackCatalog.byId['source.lis3dh']);
        assert.equal(fallbackCatalog.byId['suivi.kalman_2d'].outputs[0].kind, 'estimate');
    } finally {
        if (typeof previousEmbeddedCatalog === 'undefined') {
            delete globalThis.FLOW_EMBEDDED_CATALOG;
        } else {
            globalThis.FLOW_EMBEDDED_CATALOG = previousEmbeddedCatalog;
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
