const assert = require('node:assert/strict');

const {
    createSimpleFlowState,
    transitionSimpleFlowState,
    buildSimpleFlowModel
} = require('../simple-flowchart.js');

assert.deepStrictEqual(createSimpleFlowState(), { expanded: false });
assert.deepStrictEqual(createSimpleFlowState({ expanded: true }), { expanded: true });

assert.deepStrictEqual(
    transitionSimpleFlowState(null, { type: 'expand' }),
    { expanded: true }
);

assert.deepStrictEqual(
    transitionSimpleFlowState({ expanded: true }, { type: 'collapse' }),
    { expanded: false }
);

assert.deepStrictEqual(
    transitionSimpleFlowState({ expanded: false }, { type: 'toggle' }),
    { expanded: true }
);

const collapsedModel = buildSimpleFlowModel();
assert.equal(collapsedModel.steps.length, 8);
assert.equal(collapsedModel.visibleSteps.length, 4);
assert.deepStrictEqual(
    collapsedModel.visibleSteps.map(step => step.id),
    ['boot', 'sample', 'pipeline', 'notify']
);
assert.equal(collapsedModel.expandableStepId, 'pipeline');

const expandedModel = buildSimpleFlowModel({ expanded: true });
assert.equal(expandedModel.visibleSteps.length, 8);
assert.deepStrictEqual(
    expandedModel.visibleSteps.map(step => step.id),
    ['boot', 'sample', 'pipeline', 'window', 'filter', 'detect', 'smooth', 'notify']
);
assert.equal(
    expandedModel.steps.filter(step => step.revealOnExpand).length,
    4
);
