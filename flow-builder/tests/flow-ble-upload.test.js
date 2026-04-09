const assert = require('node:assert/strict');

const { createPipelineFrames, PP_CHUNK_FLAG_FIRST, PP_CHUNK_FLAG_LAST } = require('../src/flow-ble-upload.js');

function test_create_pipeline_frames() {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const frames = createPipelineFrames(payload, 2);

    assert.equal(frames.length, 3);
    assert.deepEqual(Array.from(frames[0]), [0, PP_CHUNK_FLAG_FIRST, 1, 2]);
    assert.deepEqual(Array.from(frames[1]), [1, 0, 3, 4]);
    assert.deepEqual(Array.from(frames[2]), [2, PP_CHUNK_FLAG_LAST, 5]);
    console.log('  PASS: test_create_pipeline_frames');
}

test_create_pipeline_frames();
console.log('All BLE upload tests passed.');
