(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowRuntimeClient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function createFlowRuntimeClient(options = {}) {
        let worker = null;
        let requestId = 0;
        const pending = new Map();

        function attachWorkerHandlers(activeWorker) {
            activeWorker.onmessage = (event) => {
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

            activeWorker.onerror = (event) => {
                const message = event && event.message
                    ? event.message
                    : 'runtime worker startup failed';

                rejectAll(new Error(message));
            };

            activeWorker.onmessageerror = () => {
                rejectAll(new Error('runtime worker message transport failed'));
            };
        }

        function ensureWorker() {
            if (worker) {
                return worker;
            }

            worker = options.workerFactory
                ? options.workerFactory()
                : new Worker(options.workerUrl || 'flow-runtime-worker.js');

            attachWorkerHandlers(worker);
            return worker;
        }

        function rejectAll(error) {
            for (const handlers of pending.values()) {
                handlers.reject(error);
            }

            pending.clear();
        }

        function call(type, payload) {
            const id = ++requestId;

            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });

                try {
                    ensureWorker().postMessage({ requestId: id, type, payload });
                } catch (error) {
                    pending.delete(id);
                    reject(error);
                }
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
