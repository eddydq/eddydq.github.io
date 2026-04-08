(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowRuntimeClient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function createFlowRuntimeClient(options = {}) {
        const worker = options.workerFactory
            ? options.workerFactory()
            : new Worker(options.workerUrl || 'flow-runtime-worker.js');
        let requestId = 0;
        const pending = new Map();

        worker.onmessage = (event) => {
            const data = event && event.data ? event.data : {};
            const id = data.requestId;

            if (!pending.has(id)) {
                return;
            }

            const handlers = pending.get(id);
            pending.delete(id);

            if (data.ok) {
                handlers.resolve(data.payload);
                return;
            }

            handlers.reject(new Error(data.error || 'runtime worker error'));
        };

        function call(type, payload) {
            const id = ++requestId;

            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                worker.postMessage({ requestId: id, type, payload });
            });
        }

        return {
            loadCatalog() {
                return call('catalog', {});
            },
            runGraph(payload) {
                return call('run', payload);
            }
        };
    }

    return { createFlowRuntimeClient };
}));
