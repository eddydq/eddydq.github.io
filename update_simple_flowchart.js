const fs = require('fs');

let js = fs.readFileSync('simple-flowchart.js', 'utf8');

const updatedLogic = `
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
`;

js = js.replace(/function transitionSimpleFlowState[\s\S]+?return \{\n\s+mode: current.mode,[\s\S]+?\}\);\n    \}/, updatedLogic);

fs.writeFileSync('simple-flowchart.js', js);
