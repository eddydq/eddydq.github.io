import fs from 'node:fs';
import path from 'node:path';
import runtimeModuleFactory from './runtime-catalog-node.mjs';

const runtime = await runtimeModuleFactory();
const pointer = runtime._pp_wasm_catalog_json();
const json = runtime.UTF8ToString(pointer);
const outPath = path.resolve('assets/flow-block-catalog.json');

fs.writeFileSync(outPath, `${json}\n`, 'utf8');
console.log(`wrote ${outPath}`);
