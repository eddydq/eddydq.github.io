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

assert.deepStrictEqual(createFlowchartState(null), overviewState);

assert.deepStrictEqual(
    transitionFlowchartState(null, { type: 'open-detail', lane: 'imu' }),
    {
        mode: 'detail',
        openLanes: { imu: true, dsp: false, ble: false }
    }
);

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

const plainMultiOpenState = {
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: true }
};

const plainMultiOpenCollapse = transitionFlowchartState(
    plainMultiOpenState,
    { type: 'collapse-lane', lane: 'imu' }
);

assert.deepStrictEqual(plainMultiOpenCollapse, {
    mode: 'detail',
    openLanes: { imu: false, dsp: false, ble: true }
});
assert.strictEqual(buildMainFlowchartDefinition(plainMultiOpenCollapse), buildMainFlowchartDefinition('ble'));

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
    getFlowchartActionFromClassName('node default nodeOverviewImu nodeImu'),
    { type: 'expand', expandedFlow: 'imu' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeLaneBle'),
    { type: 'expand-lane', lane: 'ble' }
);
assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default nodeLaneBle nodeBle'),
    { type: 'expand', expandedFlow: 'ble' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default laneCloseDsp'),
    { type: 'collapse-lane', lane: 'dsp' }
);
assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default laneCloseDsp closeBtn'),
    { type: 'collapse' }
);

assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default detailBack'),
    { type: 'back-overview' }
);
assert.deepStrictEqual(
    getFlowchartActionFromClassName('node default detailBack closeBtn'),
    { type: 'collapse' }
);

const overviewDefinition = buildMainFlowchartDefinition();
const overviewStateDefinition = buildMainFlowchartDefinition(overviewState);
const imuStateDefinition = buildMainFlowchartDefinition(detailState);
const multiOpenDefinition = buildMainFlowchartDefinition(multiOpenState);
const overviewStoryDefinition = buildMainFlowchartDefinition(createFlowchartState());
const detailBoardDefinition = buildMainFlowchartDefinition(createFlowchartState({
    mode: 'detail',
    openLanes: { imu: true, dsp: false, ble: true }
}));
const collapsedLastLaneState = transitionFlowchartState(
    detailState,
    { type: 'collapse-lane', lane: 'imu' }
);
const collapsedLastLaneDefinition = buildMainFlowchartDefinition(collapsedLastLaneState);

assert.match(overviewDefinition, /nodeOverviewImu/);
assert.match(overviewDefinition, /nodeOverviewBle/);
assert.match(overviewDefinition, /nodeOverviewDsp/);
assert.strictEqual(overviewStateDefinition, overviewDefinition);
assert.match(overviewStoryDefinition, /graph LR;/);
assert.match(overviewStoryDefinition, /Boot/);
assert.match(overviewStoryDefinition, /BLE advertise/);
assert.match(overviewStoryDefinition, /CSC notifications/);
assert.match(overviewStoryDefinition, /nodeOverviewImu/);
assert.match(overviewStoryDefinition, /nodeOverviewDsp/);
assert.match(overviewStoryDefinition, /nodeOverviewBle/);
assert.match(overviewStoryDefinition, /nodeImu/);
assert.match(overviewStoryDefinition, /nodeDsp/);
assert.match(overviewStoryDefinition, /nodeBle/);
assert.notStrictEqual(imuStateDefinition, overviewDefinition);
assert.notStrictEqual(multiOpenDefinition, overviewDefinition);
assert.strictEqual(imuStateDefinition, buildMainFlowchartDefinition('imu'));
assert.notStrictEqual(multiOpenDefinition, buildMainFlowchartDefinition('ble'));
assert.match(detailBoardDefinition, /subgraph LANE_IMU/);
assert.match(detailBoardDefinition, /subgraph LANE_DSP/);
assert.match(detailBoardDefinition, /subgraph LANE_BLE/);
assert.match(detailBoardDefinition, /laneCloseImu/);
assert.match(detailBoardDefinition, /laneCloseBle/);
assert.doesNotMatch(detailBoardDefinition, /laneCloseDsp/);
assert.match(detailBoardDefinition, /closeBtn/);
assert.match(detailBoardDefinition, /detailBack/);
assert.match(detailBoardDefinition, /nodeLaneDsp/);
assert.match(detailBoardDefinition, /nodeDsp/);
assert.match(detailBoardDefinition, /Sample store/);
assert.match(detailBoardDefinition, /CSC notify/);
assert.match(detailBoardDefinition, /nodeDspFlow/);
assert.doesNotMatch(detailBoardDefinition, /\bdirection TD\b/);
assert.deepStrictEqual(collapsedLastLaneState, overviewState);
assert.strictEqual(collapsedLastLaneDefinition, overviewDefinition);

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
