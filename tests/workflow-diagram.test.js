const assert = require('node:assert/strict');

const {
    createFlowchartState,
    buildMainFlowchartDefinition,
    transitionFlowchartState,
    getFlowchartActionFromClassName
} = require('../workflow-diagram.js');

const overviewState = createFlowchartState();
assert.deepStrictEqual(overviewState, {
    mode: 'overview',
    openLanes: { imu: false, dsp: false, ble: false }
});

const detailState = transitionFlowchartState(
    overviewState,
    { type: 'open-detail', lane: 'imu' }
);

assert.deepStrictEqual(detailState, {
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: false }
});

const multiOpenState = transitionFlowchartState(
    detailState,
    { type: 'expand-lane', lane: 'ble' }
);

assert.deepStrictEqual(multiOpenState, {
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: true }
});

const collapsedState = transitionFlowchartState(
    multiOpenState,
    { type: 'collapse-lane', lane: 'imu' }
);

assert.deepStrictEqual(collapsedState, {
    mode: 'detail',
    openLanes: { imu: false, dsp: false, ble: true }
});

assert.deepStrictEqual(
    transitionFlowchartState(collapsedState, { type: 'back-overview' }),
    {
        mode: 'overview',
        openLanes: { imu: false, dsp: false, ble: false }
    }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeOverviewImu'),
    { type: 'open-detail', lane: 'imu' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeLaneBle'),
    { type: 'expand-lane', lane: 'ble' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default laneCloseDsp'),
    { type: 'collapse-lane', lane: 'dsp' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default detailBack'),
    { type: 'back-overview' }
);

const overviewDefinition = buildMainFlowchartDefinition();
const overviewStateDefinition = buildMainFlowchartDefinition(overviewState);
const imuStateDefinition = buildMainFlowchartDefinition(detailState);

assert.match(overviewDefinition, /nodeImu/);
assert.match(overviewDefinition, /nodeBle/);
assert.match(overviewDefinition, /nodeDsp/);
assert.strictEqual(overviewStateDefinition, overviewDefinition);
assert.strictEqual(imuStateDefinition, buildMainFlowchartDefinition('imu'));
assert.match(imuStateDefinition, /IMU_Close\(\( - \)\):::closeBtn/);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeImu'),
    { type: 'expand', expandedFlow: 'imu' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeBle'),
    { type: 'expand', expandedFlow: 'ble' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeDsp'),
    { type: 'expand', expandedFlow: 'dsp' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default closeBtn'),
    { type: 'collapse' }
);
