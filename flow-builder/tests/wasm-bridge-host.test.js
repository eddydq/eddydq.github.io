const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const firmwareDir = path.join(root, 'flow-builder', 'wasm', 'firmware');
const wasmDir = path.join(root, 'flow-builder', 'wasm');

function commandExists(command) {
    const result = childProcess.spawnSync(command, ['--version'], { encoding: 'utf8' });
    return !result.error && result.status === 0;
}

if (!commandExists('gcc')) {
    console.log('SKIP: gcc is not available; native wasm bridge host regression not run.');
    process.exit(0);
}

const peakGraph = {
    schema_version: 2,
    nodes: [
        {
            node_id: 'peak',
            block_id: 'validation.peak_selector',
            params: { min_prominence: 1, min_distance: 1 }
        }
    ],
    connections: [
        { source: 'input.candidate', source_socket: 0, target: 'peak.candidate', target_socket: 0 },
        { source: 'input.series', source_socket: 0, target: 'peak.series', target_socket: 0 }
    ],
    outputs: { final: 'peak.primary' }
};

const peakInputs = [
    {
        binding_name: 'candidate',
        packet: {
            kind: 'candidate',
            data: { sample_rate_hz: 52, length: 2, values: [60, 90] }
        }
    },
    {
        binding_name: 'series',
        packet: {
            kind: 'series',
            data: { sample_rate_hz: 52, length: 5, values: [0, 1, 5, 1, 0] }
        }
    }
];

const confidenceGraph = {
    schema_version: 2,
    nodes: [
        {
            node_id: 'gate',
            block_id: 'validation.confidence_gate',
            params: { min_confidence: 50, fallback_value: 123 }
        }
    ],
    connections: [
        { source: 'input.candidate', source_socket: 0, target: 'gate.source', target_socket: 0 },
        { source: 'gate.rejected', source_socket: 0, target: 'output.final', target_socket: 0 }
    ],
    outputs: { final: 'gate.rejected' }
};

const confidenceInputs = [
    {
        binding_name: 'candidate',
        packet: {
            kind: 'candidate',
            data: { sample_rate_hz: 52, length: 2, values: [80, 10] }
        }
    }
];

const missingSchemaGraph = { ...peakGraph };
delete missingSchemaGraph.schema_version;

const unsupportedSchemaGraph = { ...peakGraph, schema_version: 999 };

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-wasm-bridge-host-'));
const harnessPath = path.join(tempDir, 'wasm_bridge_host_test.c');
const exePath = path.join(tempDir, process.platform === 'win32' ? 'wasm_bridge_host_test.exe' : 'wasm_bridge_host_test');

fs.writeFileSync(harnessPath, `
#include <stdio.h>
#include <string.h>

const char *pp_wasm_last_result_json(void);
int pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json);

static int run_case(const char *name, const char *graph_json, const char *inputs_json, const char *expected)
{
    int status = pp_wasm_run_graph_json(graph_json, inputs_json);
    const char *result = pp_wasm_last_result_json();

    if (status != 0) {
        fprintf(stderr, "%s returned status %d: %s\\n", name, status, result);
        return 1;
    }
    if (!strstr(result, expected)) {
        fprintf(stderr, "%s result did not contain expected substring.\\nExpected: %s\\nActual: %s\\n", name, expected, result);
        return 1;
    }
    return 0;
}

static int run_rejected_case(const char *name, const char *graph_json, const char *inputs_json, const char *expected_error)
{
    int status = pp_wasm_run_graph_json(graph_json, inputs_json);
    const char *result = pp_wasm_last_result_json();

    if (status == 0) {
        fprintf(stderr, "%s unexpectedly succeeded: %s\\n", name, result);
        return 1;
    }
    if (!strstr(result, expected_error)) {
        fprintf(stderr, "%s error did not contain expected substring.\\nExpected: %s\\nActual: %s\\n", name, expected_error, result);
        return 1;
    }
    return 0;
}

int main(void)
{
    if (run_case(
            "peak_selector_named_ports",
            ${JSON.stringify(JSON.stringify(peakGraph))},
            ${JSON.stringify(JSON.stringify(peakInputs))},
            "\\\"final\\\":{\\\"kind\\\":\\\"candidate\\\",\\\"axis\\\":255,\\\"sample_rate_hz\\\":52,\\\"length\\\":2,\\\"values\\\":[2,5]")) {
        return 1;
    }
    if (run_case(
            "confidence_gate_rejected_output",
            ${JSON.stringify(JSON.stringify(confidenceGraph))},
            ${JSON.stringify(JSON.stringify(confidenceInputs))},
            "\\\"final\\\":{\\\"kind\\\":\\\"candidate\\\",\\\"axis\\\":255,\\\"sample_rate_hz\\\":52,\\\"length\\\":2,\\\"values\\\":[123,10]")) {
        return 1;
    }
    if (run_rejected_case(
            "missing_schema_version",
            ${JSON.stringify(JSON.stringify(missingSchemaGraph))},
            ${JSON.stringify(JSON.stringify(peakInputs))},
            "schema_version")) {
        return 1;
    }
    if (run_rejected_case(
            "unsupported_schema_version",
            ${JSON.stringify(JSON.stringify(unsupportedSchemaGraph))},
            ${JSON.stringify(JSON.stringify(peakInputs))},
            "unsupported schema_version")) {
        return 1;
    }
    return 0;
}
`, 'utf8');

const firmwareSources = fs.readdirSync(firmwareDir)
    .filter(name => name.endsWith('.c'))
    .sort()
    .map(name => path.join(firmwareDir, name));

const compileArgs = [
    '-std=c99',
    '-Wall',
    '-Wextra',
    '-DPP_TARGET_WASM',
    '-I',
    firmwareDir,
    harnessPath,
    ...firmwareSources,
    path.join(wasmDir, 'pp_wasm_bridge.c'),
    path.join(wasmDir, 'pp_hw_stubs.c'),
    '-o',
    exePath
];

const compile = childProcess.spawnSync('gcc', compileArgs, { encoding: 'utf8' });
assert.equal(compile.status, 0, `gcc bridge harness compile failed\nSTDOUT:\n${compile.stdout}\nSTDERR:\n${compile.stderr}`);

const run = childProcess.spawnSync(exePath, [], { encoding: 'utf8' });
assert.equal(run.status, 0, `bridge host regression failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
