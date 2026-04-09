const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const browserRuntimeFactory = require(path.join(root, 'flow-builder', 'assets', 'flow-runtime.js'));
const expectedCatalog = JSON.parse(
    fs.readFileSync(path.join(root, 'flow-builder', 'assets', 'flow-block-catalog.json'), 'utf8')
);

function sortedBlockIds(catalog) {
    return catalog.blocks.map(block => block.block_id).sort();
}

function writeModuleString(module, value) {
    const length = module.lengthBytesUTF8(value) + 1;
    const pointer = module._malloc(length);
    module.stringToUTF8(value, pointer, length);
    return pointer;
}

async function main() {
    const module = await browserRuntimeFactory();
    const runtimeCatalog = JSON.parse(module.UTF8ToString(module._pp_wasm_catalog_json()));

    assert.deepStrictEqual(
        sortedBlockIds(runtimeCatalog),
        sortedBlockIds(expectedCatalog),
        'browser runtime block ids should match flow-block-catalog.json'
    );

    const lowpassGraph = {
        schema_version: 2,
        nodes: [
            {
                node_id: 'lowpass',
                block_id: 'pretraitement.lowpass',
                params: { cutoff_hz: 1, order: 1 }
            }
        ],
        connections: [
            { source: 'input.series', source_socket: 0, target: 'lowpass.source', target_socket: 0 }
        ],
        outputs: { final: 'lowpass.primary' }
    };

    const lowpassInputs = [
        {
            binding_name: 'series',
            packet: {
                kind: 'series',
                data: { sample_rate_hz: 52, length: 4, values: [1, 2, 3, 4] }
            }
        }
    ];

    const graphPtr = writeModuleString(module, JSON.stringify(lowpassGraph));
    const inputsPtr = writeModuleString(module, JSON.stringify(lowpassInputs));

    try {
        const status = module._pp_wasm_run_graph_json(graphPtr, inputsPtr);
        const result = JSON.parse(module.UTF8ToString(module._pp_wasm_last_result_json()));

        assert.equal(status, 0, `browser runtime lowpass graph should succeed: ${JSON.stringify(result)}`);
        assert.equal(result.outputs.final.kind, 'series');
        assert.equal(result.outputs.final.length, 4);
        assert.deepStrictEqual(
            result.diagnostics.nodes.map(node => node.block_id),
            ['pretraitement.lowpass']
        );
    } finally {
        module._free(graphPtr);
        module._free(inputsPtr);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
