import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimeModuleFactory from './runtime-catalog-node.mjs';

const runtime = await runtimeModuleFactory();
const json = runtime.UTF8ToString(runtime._pp_wasm_catalog_json());
const parsed = JSON.parse(json);
if (!Array.isArray(parsed.blocks) || parsed.blocks.length !== 16) {
    throw new Error(`expected 16 firmware blocks, got ${parsed.blocks && parsed.blocks.length}`);
}
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const catalogRelativePath = 'flow-builder/assets/flow-block-catalog.json';
const outPath = path.join(repoRoot, ...catalogRelativePath.split('/'));
fs.writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
console.log(`wrote ${outPath}`);
