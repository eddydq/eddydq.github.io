(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowBleUpload = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const PP_SERVICE_UUID = '7b6d4b20-4f4d-4a56-9f6a-70756c736530';
    const PP_CP_UUID = '7b6d4b21-4f4d-4a56-9f6a-70756c736530';
    const PP_STATUS_UUID = '7b6d4b22-4f4d-4a56-9f6a-70756c736530';

    const PP_CHUNK_FLAG_FIRST = 0x01;
    const PP_CHUNK_FLAG_LAST = 0x02;
    const PP_CHUNK_FLAG_ABORT = 0x04;

    function toUint8Array(payload) {
        if (payload instanceof Uint8Array) {
            return payload;
        }
        if (payload instanceof ArrayBuffer) {
            return new Uint8Array(payload);
        }
        if (ArrayBuffer.isView(payload)) {
            return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
        }
        throw new Error('binary payload must be a Uint8Array or ArrayBuffer');
    }

    function createPipelineFrames(binaryPayload, chunkSize) {
        const payload = toUint8Array(binaryPayload);
        const size = Math.max(1, Math.floor(Number(chunkSize) || 242));
        const totalChunks = Math.max(1, Math.ceil(payload.length / size));
        const frames = [];

        for (let index = 0; index < totalChunks; index += 1) {
            const offset = index * size;
            const chunk = payload.slice(offset, offset + size);
            const flags = (index === 0 ? PP_CHUNK_FLAG_FIRST : 0) |
                (index === totalChunks - 1 ? PP_CHUNK_FLAG_LAST : 0);
            const frame = new Uint8Array(2 + chunk.length);
            frame[0] = index & 0xFF;
            frame[1] = flags;
            frame.set(chunk, 2);
            frames.push(frame);
        }

        return frames;
    }

    async function uploadPipeline(binaryPayload, onProgress, options = {}) {
        const bluetooth = options.bluetooth || (globalThis.navigator && globalThis.navigator.bluetooth);
        if (!bluetooth || typeof bluetooth.requestDevice !== 'function') {
            throw new Error('Web Bluetooth is not available in this browser');
        }

        const device = await bluetooth.requestDevice({
            filters: [{ services: ['cycling_speed_and_cadence'] }], // The device advertises standard CSC
            optionalServices: [PP_SERVICE_UUID]                     // Allow access to our custom pipeline service
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(PP_SERVICE_UUID);
        const controlPoint = await service.getCharacteristic(PP_CP_UUID);
        const statusCharacteristic = await service.getCharacteristic(PP_STATUS_UUID);

        let notifiedStatus = null;
        if (typeof statusCharacteristic.startNotifications === 'function') {
            await statusCharacteristic.startNotifications();
            statusCharacteristic.addEventListener('characteristicvaluechanged', event => {
                notifiedStatus = event.target.value.getUint8(0);
            });
        }

        const mtu = Math.max(20, Math.floor(Number(options.mtu) || 244));
        const frames = createPipelineFrames(binaryPayload, mtu - 2);

        for (let index = 0; index < frames.length; index += 1) {
            if (typeof controlPoint.writeValueWithResponse === 'function') {
                await controlPoint.writeValueWithResponse(frames[index]);
            } else {
                await controlPoint.writeValue(frames[index]);
            }
            if (typeof onProgress === 'function') {
                onProgress((index + 1) / frames.length);
            }
        }

        const finalValue = await statusCharacteristic.readValue();
        const finalStatus = notifiedStatus ?? finalValue.getUint8(0);
        if (finalStatus >= 0x80) {
            throw new Error(`Device error: 0x${finalStatus.toString(16).padStart(2, '0')}`);
        }

        return finalStatus;
    }

    return {
        PP_SERVICE_UUID,
        PP_CP_UUID,
        PP_STATUS_UUID,
        PP_CHUNK_FLAG_FIRST,
        PP_CHUNK_FLAG_LAST,
        PP_CHUNK_FLAG_ABORT,
        createPipelineFrames,
        uploadPipeline
    };
}));
