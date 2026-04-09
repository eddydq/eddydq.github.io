const assert = require('node:assert/strict');

const {
    createSimpleFlowState,
    transitionSimpleFlowState,
    buildSimpleFlowModel
} = require('../simple-flowchart.js');

assert.deepStrictEqual(createSimpleFlowState(), { mode: 'overview', expandedLanes: [] });
assert.deepStrictEqual(createSimpleFlowState({ mode: 'inline', expandedLanes: ['dsp'] }), { mode: 'inline', expandedLanes: ['dsp'] });

assert.deepStrictEqual(
    transitionSimpleFlowState(null, { type: 'toggle_lane', laneId: 'imu' }),
    { mode: 'overview', expandedLanes: ['imu'] }
);

assert.deepStrictEqual(
    transitionSimpleFlowState({ mode: 'inline', expandedLanes: ['imu'] }, { type: 'toggle_lane', laneId: 'dsp' }),
    { mode: 'inline', expandedLanes: ['imu', 'dsp'] }
);

assert.deepStrictEqual(
    transitionSimpleFlowState({ mode: 'inline', expandedLanes: ['imu', 'dsp'] }, { type: 'toggle_lane', laneId: 'imu' }),
    { mode: 'inline', expandedLanes: ['dsp'] }
);

const overviewModel = buildSimpleFlowModel();
assert.equal(overviewModel.mode, 'inline');
assert.equal(overviewModel.steps.length, 8); // 7 overview + 1 loop
assert.equal(overviewModel.steps[0].visible, true);

const detailModel = buildSimpleFlowModel({ mode: 'inline', expandedLanes: ['dsp'] });
assert.equal(detailModel.mode, 'inline');
// 7 overview + 5 dsp steps + 1 loop = 13 steps
assert.equal(detailModel.steps.length, 13);
assert.equal(detailModel.steps.filter(s => s.isSubStep).length, 5);
