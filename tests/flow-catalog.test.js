const assert = require('node:assert/strict');
const fs = require('node:fs');

const { loadCatalog, normalizeCatalog } = require('../flow-catalog.js');

const catalog = JSON.parse(fs.readFileSync('assets/flow-block-catalog.json', 'utf8'));
const normalized = normalizeCatalog(catalog);

assert.ok(normalized.byId['representation.select_axis']);
assert.ok(normalized.byId['estimation.autocorrelation']);
assert.equal(normalized.byKind.series.colorClass, 'port-kind-series');
assert.equal(normalized.byId['validation.spm_range_gate'].outputs[0].name, 'accepted');

async function main() {
    const previousEmbeddedCatalog = globalThis.FLOW_EMBEDDED_CATALOG;

    try {
        globalThis.FLOW_EMBEDDED_CATALOG = catalog;

        const fallbackCatalog = await loadCatalog(async () => {
            throw new Error('fetch blocked');
        });

        assert.ok(fallbackCatalog.byId['representation.select_axis']);
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
