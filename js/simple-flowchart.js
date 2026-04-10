(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.SimpleFlowchart = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const OVERVIEW_STEPS = [
        { id: 'boot', labelKey: 'flow-step-boot', tone: 'core', isInteractive: false },
        { id: 'ble-adv', labelKey: 'flow-step-ble-adv', tone: 'core', isInteractive: false },
        { id: 'client-conn', labelKey: 'flow-step-client-conn', tone: 'core', isInteractive: false },
        { id: 'csc-en', labelKey: 'flow-step-csc-en', tone: 'core', isInteractive: false },
        { id: 'sensor-in', labelKey: 'flow-step-sensor-in', tone: 'summary', isInteractive: true, laneId: 'imu' },
        { id: 'stroke-est', labelKey: 'flow-step-stroke-est', tone: 'summary', isInteractive: true, laneId: 'dsp' },
        { id: 'ble-out', labelKey: 'flow-step-ble-out', tone: 'summary', isInteractive: true, laneId: 'ble' }
    ];

    const LANES = {
        imu: {
            id: 'imu', titleKey: 'lane-imu', steps: [
                { id: 'imu-src', labelKey: 'flow-step-imu-src', tone: 'detail' },
                { id: 'imu-init', labelKey: 'flow-step-imu-init', tone: 'detail' },
                { id: 'imu-start', labelKey: 'flow-step-imu-start', tone: 'detail' },
                { id: 'imu-proc', labelKey: 'flow-step-imu-proc', tone: 'detail' },
                { id: 'imu-push', labelKey: 'flow-step-imu-push', tone: 'detail' }
            ]
        },
        dsp: {
            id: 'dsp', titleKey: 'lane-dsp', steps: [
                { id: 'dsp-store', labelKey: 'flow-step-dsp-store', tone: 'detail' },
                { id: 'dsp-auto', labelKey: 'flow-step-dsp-auto', tone: 'detail' },
                { id: 'dsp-guard', labelKey: 'flow-step-dsp-guard', tone: 'detail' },
                { id: 'dsp-kalman', labelKey: 'flow-step-dsp-kalman', tone: 'detail' },
                { id: 'dsp-rpm', labelKey: 'flow-step-dsp-rpm', tone: 'detail' }
            ]
        },
        ble: {
            id: 'ble', titleKey: 'lane-ble', steps: [
                { id: 'ble-adv-lane', labelKey: 'flow-step-ble-adv', tone: 'detail' },
                { id: 'ble-conn', labelKey: 'flow-step-client-conn', tone: 'detail' },
                { id: 'ble-csc-en', labelKey: 'flow-step-csc-en', tone: 'detail' },
                { id: 'ble-start', labelKey: 'flow-step-ble-start', tone: 'detail' },
                { id: 'ble-timer', labelKey: 'flow-step-ble-timer', tone: 'detail' },
                { id: 'ble-notify', labelKey: 'flow-step-ble-notify', tone: 'detail' }
            ]
        }
    };

    function createSimpleFlowState(overrides = {}) {
        return {
            mode: overrides?.mode || 'overview',
            expandedLanes: Array.isArray(overrides?.expandedLanes) ? [...overrides.expandedLanes] : []
        };
    }

    
    function transitionSimpleFlowState(state, action) {
        const current = createSimpleFlowState(state);

        if (action?.type === 'toggle_lane' && action.laneId) {
            const hasLane = current.expandedLanes.includes(action.laneId);
            const nextLanes = hasLane
                ? current.expandedLanes.filter(id => id !== action.laneId)
                : [...current.expandedLanes, action.laneId];

            return createSimpleFlowState({
                mode: current.mode,
                expandedLanes: nextLanes
            });
        }

        return current;
    }

    function buildSimpleFlowModel(state) {
        const current = createSimpleFlowState(state);
        let visibleSteps = [];

        OVERVIEW_STEPS.forEach(step => {
            const isExpanded = current.expandedLanes.includes(step.laneId);
            visibleSteps.push({ ...step, visible: true, isExpanded });
            
            if (step.laneId && isExpanded) {
                const lane = LANES[step.laneId];
                lane.steps.forEach(subStep => {
                    visibleSteps.push({ ...subStep, visible: true, isSubStep: true, parentLane: step.laneId });
                });
            }
        });

        // Add a fake return node to draw an arrow back
        visibleSteps.push({ id: 'loop-return', labelKey: 'flow-step-loop', tone: 'core', isInteractive: false, isReturn: true });

        return {
            mode: 'inline',
            expandedLanes: current.expandedLanes,
            steps: visibleSteps
        };
    }

    return {
        createSimpleFlowState,
        transitionSimpleFlowState,
        buildSimpleFlowModel
    };
}));
