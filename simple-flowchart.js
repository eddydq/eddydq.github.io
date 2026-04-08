(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.SimpleFlowchart = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const STEP_DEFINITIONS = [
        { id: 'boot', labelKey: 'flow-step-boot', tone: 'core', revealOnExpand: false },
        { id: 'sample', labelKey: 'flow-step-sample', tone: 'core', revealOnExpand: false },
        { id: 'pipeline', labelKey: 'flow-step-pipeline', tone: 'summary', revealOnExpand: false, isExpandable: true },
        { id: 'window', labelKey: 'flow-step-window', tone: 'detail', revealOnExpand: true },
        { id: 'filter', labelKey: 'flow-step-filter', tone: 'detail', revealOnExpand: true },
        { id: 'detect', labelKey: 'flow-step-detect', tone: 'detail', revealOnExpand: true },
        { id: 'smooth', labelKey: 'flow-step-smooth', tone: 'detail', revealOnExpand: true },
        { id: 'notify', labelKey: 'flow-step-notify', tone: 'core', revealOnExpand: false }
    ];

    function createSimpleFlowState(overrides = {}) {
        return {
            expanded: Boolean(overrides?.expanded)
        };
    }

    function transitionSimpleFlowState(state, action) {
        const current = createSimpleFlowState(state);

        if (action?.type === 'expand') {
            return createSimpleFlowState({ expanded: true });
        }

        if (action?.type === 'collapse') {
            return createSimpleFlowState({ expanded: false });
        }

        if (action?.type === 'toggle') {
            return createSimpleFlowState({ expanded: !current.expanded });
        }

        if (action?.type === 'toggle-step' && action.stepId === 'pipeline') {
            return createSimpleFlowState({ expanded: !current.expanded });
        }

        return current;
    }

    function buildSimpleFlowModel(state) {
        const current = createSimpleFlowState(state);
        const steps = STEP_DEFINITIONS.map(step => ({
            ...step,
            visible: !step.revealOnExpand || current.expanded
        }));

        return {
            expanded: current.expanded,
            expandableStepId: 'pipeline',
            steps,
            visibleSteps: steps.filter(step => step.visible)
        };
    }

    return {
        createSimpleFlowState,
        transitionSimpleFlowState,
        buildSimpleFlowModel
    };
}));
