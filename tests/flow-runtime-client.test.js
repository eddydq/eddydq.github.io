const assert = require('node:assert/strict');

const { createFlowRuntimeClient } = require('../flow-builder/src/flow-runtime-client.js');

const messages = [];
const fakeWorker = {
    onmessage: null,
    postMessage(message) {
        messages.push(message);
        if (message.type === 'catalog') {
            this.onmessage({ data: { requestId: message.requestId, ok: true, payload: { blocks: [] } } });
        }
        if (message.type === 'run') {
            this.onmessage({
                data: {
                    requestId: message.requestId,
                    ok: true,
                    payload: { outputs: { final: [] }, diagnostics: {} }
                }
            });
        }
    }
};

async function main() {
    const client = createFlowRuntimeClient({ workerFactory: () => fakeWorker });
    const catalog = await client.loadCatalog();
    const result = await client.runGraph({
        graph: { schema_version: 2, nodes: [], connections: [], outputs: {} },
        inputs: []
    });

    assert.deepStrictEqual(catalog, { blocks: [] });
    assert.deepStrictEqual(result.outputs, { final: [] });
    assert.equal(messages[0].type, 'catalog');
    assert.equal(messages[1].type, 'run');

    const errorWorker = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage() {
            setTimeout(() => {
                this.onerror({ message: 'worker boot failed' });
            }, 0);
        }
    };
    const errorClient = createFlowRuntimeClient({ workerFactory: () => errorWorker });

    await assert.rejects(
        Promise.race([
            errorClient.loadCatalog(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), 50);
            })
        ]),
        /worker boot failed/
    );

    let factoryCalls = 0;
    const unsupportedClient = createFlowRuntimeClient({
        workerFactory: () => {
            factoryCalls += 1;
            throw new Error('worker unsupported');
        }
    });

    assert.equal(factoryCalls, 0);
    await assert.rejects(
        unsupportedClient.runGraph({
            graph: { schema_version: 2, nodes: [], connections: [], outputs: {} },
            inputs: []
        }),
        /worker unsupported/
    );
    assert.equal(factoryCalls, 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
