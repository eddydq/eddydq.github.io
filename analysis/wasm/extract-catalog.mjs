import fs from 'node:fs';
import path from 'node:path';
import runtimeModuleFactory from './runtime-catalog-node.mjs';

const runtime = await runtimeModuleFactory();
const pointer = runtime._pp_wasm_catalog_json();
const json = runtime.UTF8ToString(pointer);
const parsed = JSON.parse(json);
const outPath = path.resolve('assets/flow-block-catalog.json');
const outJsPath = path.resolve('assets/flow-block-catalog.js');

if (!parsed || parsed.error || !Array.isArray(parsed.blocks)) {
    throw new Error(`catalog export failed: ${parsed && parsed.error ? parsed.error : 'missing blocks array'}`);
}

fs.writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
fs.writeFileSync(outJsPath, `globalThis.FLOW_EMBEDDED_CATALOG = ${JSON.stringify(parsed, null, 2)};\n`, 'utf8');
console.log(`wrote ${outPath}`);
console.log(`wrote ${outJsPath}`);
