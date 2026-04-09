let runtimeModulePromise = null;

function allocUtf8(module, value) {
    const size = module.lengthBytesUTF8(value) + 1;
    const ptr = module._malloc(size);

    module.stringToUTF8(value, ptr, size);
    return ptr;
}

async function ensureRuntime() {
    if (!runtimeModulePromise) {
        importScripts('../assets/flow-runtime.js');

        if (typeof self.createFlowRuntimeModule !== 'function') {
            throw new Error('createFlowRuntimeModule is not available');
        }

        runtimeModulePromise = self.createFlowRuntimeModule();
    }

    return runtimeModulePromise;
}

self.onmessage = async (event) => {
    const data = event && event.data ? event.data : {};
    const requestId = data.requestId;
    const type = data.type;
    const payload = data.payload || {};

    try {
        const module = await ensureRuntime();

        if (type === 'catalog') {
            const catalogPtr = module._pp_wasm_catalog_json();
            const catalog = JSON.parse(module.UTF8ToString(catalogPtr));

            self.postMessage({ requestId, ok: true, payload: catalog });
            return;
        }

        if (type === 'run') {
            const graphJson = JSON.stringify(payload.graph || {});
            const inputsJson = JSON.stringify(payload.inputs || []);
            const graphPtr = allocUtf8(module, graphJson);
            const inputsPtr = allocUtf8(module, inputsJson);

            try {
                const status = module._pp_wasm_run_graph_json(graphPtr, inputsPtr);
                const resultPtr = module._pp_wasm_last_result_json();
                const resultJson = module.UTF8ToString(resultPtr);

                if (status !== 0) {
                    let errorMessage = `native runtime returned status ${status}`;

                    try {
                        const errorPayload = JSON.parse(resultJson);
                        if (errorPayload && typeof errorPayload.error === 'string') {
                            errorMessage = errorPayload.error;
                        }
                    } catch (parseError) {
                        void parseError;
                    }

                    throw new Error(errorMessage);
                }

                self.postMessage({
                    requestId,
                    ok: true,
                    payload: JSON.parse(resultJson)
                });
            } finally {
                module._free(graphPtr);
                module._free(inputsPtr);
            }
            return;
        }

        self.postMessage({
            requestId,
            ok: false,
            error: `unknown worker message type: ${type}`
        });
    } catch (error) {
        self.postMessage({
            requestId,
            ok: false,
            error: error && error.message ? error.message : 'runtime worker error'
        });
    }
};
