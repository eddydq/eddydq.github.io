(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.WorkflowDiagram = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const LANE_KEYS = ['imu', 'dsp', 'ble'];
    const VALID_EXPANDED_FLOWS = new Set(['imu', 'ble', 'dsp']);
    const EXPANDED_SUBGRAPH_DIRECTION = 'TB';

    function createFlowchartState(overrides = {}) {
        return {
            mode: overrides.mode === 'detail' ? 'detail' : 'overview',
            openLanes: {
                imu: Boolean(overrides.openLanes?.imu),
                dsp: Boolean(overrides.openLanes?.dsp),
                ble: Boolean(overrides.openLanes?.ble)
            }
        };
    }

    function transitionFlowchartState(state, action) {
        const current = createFlowchartState(state);

        if (action?.type === 'back-overview') {
            return createFlowchartState();
        }

        if (!LANE_KEYS.includes(action?.lane)) {
            return current;
        }

        if (action.type === 'open-detail') {
            return createFlowchartState({
                mode: 'detail',
                openLanes: {
                    imu: action.lane === 'imu',
                    dsp: action.lane === 'dsp',
                    ble: action.lane === 'ble'
                }
            });
        }

        if (action.type === 'expand-lane') {
            return createFlowchartState({
                mode: 'detail',
                openLanes: {
                    ...current.openLanes,
                    [action.lane]: true
                }
            });
        }

        if (action.type === 'collapse-lane') {
            return createFlowchartState({
                mode: 'detail',
                openLanes: {
                    ...current.openLanes,
                    [action.lane]: false
                }
            });
        }

        return current;
    }

    function normalizeExpandedFlow(expandedFlow) {
        return VALID_EXPANDED_FLOWS.has(expandedFlow) ? expandedFlow : null;
    }

    // Legacy Mermaid output can only render one expanded lane at a time.
    // Accept both the old string contract and the new { mode, openLanes } state,
    // then collapse that richer state to the single lane this renderer supports.
    function normalizeFlowchartRenderSelection(viewStateOrExpandedFlow) {
        if (
            viewStateOrExpandedFlow === null ||
            typeof viewStateOrExpandedFlow === 'string' ||
            typeof viewStateOrExpandedFlow === 'undefined'
        ) {
            return {
                mode: 'overview',
                expandedFlow: normalizeExpandedFlow(viewStateOrExpandedFlow)
            };
        }

        const state = createFlowchartState(viewStateOrExpandedFlow);

        if (state.mode !== 'detail') {
            return {
                mode: 'overview',
                expandedFlow: null
            };
        }

        for (const lane of LANE_KEYS) {
            if (state.openLanes[lane]) {
                return {
                    mode: 'detail',
                    expandedFlow: lane
                };
            }
        }

        return {
            mode: 'detail',
            expandedFlow: null
        };
    }

    function buildMainFlowchartDefinition(viewStateOrExpandedFlow) {
        const renderState = normalizeFlowchartRenderSelection(viewStateOrExpandedFlow);
        const currentFlow = renderState.expandedFlow;
        const lines = [
            'graph TD;',
            'Init((Boot)) --> I2C[I2C Init]:::nodeImu;'
        ];

        if (currentFlow === 'imu') {
            lines.push(
                'subgraph IMU_Sub [IMU Integration]',
                // Mermaid can choke when a TD subgraph explicitly repeats the parent TD direction.
                `direction ${EXPANDED_SUBGRAPH_DIRECTION}`,
                'IMU_Close(( - )):::closeBtn',
                'Start_IMU((Start Driver)) --> Type{Sensor Type?};',
                'Type -->|LIS3DH| InitL[Write CTRL_REG1];',
                'InitL --> CfgL[Set ODR and Range];',
                'CfgL --> IntL[Enable INT1];',
                'IntL --> LoopL((Wait INT1));',
                'Type -->|MPU6050| InitM[Write PWR_MGMT_1];',
                'InitM --> CfgM[Set LPF and Rate];',
                'CfgM --> LoopM((Timer Polling));',
                'Type -->|Polar| Scan[Scan Polar];',
                'Scan --> ConnectP[Connect MAC];',
                'ConnectP --> Notif[Enable Notifications];',
                'Notif --> LoopP((Wait BLE Evt));',
                'end',
                'I2C --> Start_IMU;'
            );
        } else {
            lines.push('I2C --> IMU[IMU Wakeup]:::nodeImu;');
        }

        const imuExitNodes = currentFlow === 'imu' ? ['LoopL', 'LoopM', 'LoopP'] : ['IMU'];
        const bleEntryNode = currentFlow === 'ble' ? 'Start_BLE' : 'BLE';
        imuExitNodes.forEach((exitNode) => {
            lines.push(`${exitNode} --> ${bleEntryNode};`);
        });

        if (currentFlow === 'ble') {
            lines.push(
                'subgraph BLE_Sub [BLE Initialization]',
                `direction ${EXPANDED_SUBGRAPH_DIRECTION}`,
                'BLE_Close(( - )):::closeBtn',
                'Start_BLE((BLE App Init)) --> DB[Create CSCP DB];',
                'DB --> Profile[Load Profile 0x1816];',
                'Profile --> Gap[Set GAP params];',
                'Gap --> Adv_Sub[Start Advertising];',
                'Adv_Sub --> Peer[Peer Connected];',
                'Peer --> Setup[Setup Connection Params];',
                'Setup --> CCCD[Enable CCCD Notif];',
                'CCCD --> Run((Ready to send SPM));',
                'end'
            );
        } else {
            lines.push(
                'BLE[BLE Stack Init]:::nodeBle --> Adv[Start Advertising]:::nodeBle;',
                'Adv --> Connect{Connected?};',
                'Connect -->|Yes| CSCP[Start CSCP Notif]:::nodeBle;',
                'Connect -->|No| Adv;'
            );
        }

        const bleExitNodes = currentFlow === 'ble' ? ['Run'] : ['CSCP'];
        bleExitNodes.forEach((exitNode) => {
            lines.push(`${exitNode} --> Sleep[Extended Sleep];`);
        });

        lines.push(
            'Sleep -->|Timer/INT| Wake[Wakeup and Read IMU]:::nodeImu;'
        );

        const dspEntryNode = currentFlow === 'dsp' ? 'Input' : 'DSP';
        lines.push(`Wake --> ${dspEntryNode};`);

        if (currentFlow === 'dsp') {
            lines.push(
                'subgraph DSP_Sub [DSP Pipeline]',
                `direction ${EXPANDED_SUBGRAPH_DIRECTION}`,
                'DSP_Close(( - )):::closeBtn',
                'Input((Raw Accel)) --> LP[Low Pass Filter];',
                'LP --> Win[Autocorr Window];',
                'Win --> ACF[Compute ACF];',
                'ACF --> Peak[Find ACF Peaks];',
                'Peak --> HR[Harmonic Rejection];',
                'HR --> Interp[Parabolic Interp];',
                'Interp --> Kalman[Kalman Filter];',
                'Kalman --> Output((SPM Output Click to Test)):::nodeDspFlow;',
                'end'
            );
        } else {
            lines.push('DSP[Run DSP Pipeline]:::nodeDsp;');
        }

        const dspExitNode = currentFlow === 'dsp' ? 'Output' : 'DSP';
        lines.push(
            `${dspExitNode} --> Send[Notify Cadence];`,
            'Send --> Sleep;'
        );

        if (currentFlow === 'imu') {
            lines.push('style IMU_Sub fill:transparent,stroke:#172b45,stroke-width:2px,stroke-dasharray: 5 5;');
        }

        if (currentFlow === 'ble') {
            lines.push('style BLE_Sub fill:transparent,stroke:#172b45,stroke-width:2px,stroke-dasharray: 5 5;');
        }

        if (currentFlow === 'dsp') {
            lines.push('style DSP_Sub fill:transparent,stroke:#172b45,stroke-width:2px,stroke-dasharray: 5 5;');
        }

        lines.push(
            'classDef nodeImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeBle fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeDsp fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeDspFlow fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
            'classDef closeBtn fill:#e11d48,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;'
        );

        return lines.join('\n');
    }

    function hasClassToken(className, token) {
        return typeof className === 'string' && className.split(/\s+/).includes(token);
    }

    function getFlowchartActionFromClassName(className) {
        if (hasClassToken(className, 'detailBack')) {
            return { type: 'back-overview' };
        }
        if (hasClassToken(className, 'nodeOverviewImu')) {
            return { type: 'open-detail', lane: 'imu' };
        }
        if (hasClassToken(className, 'nodeOverviewDsp')) {
            return { type: 'open-detail', lane: 'dsp' };
        }
        if (hasClassToken(className, 'nodeOverviewBle')) {
            return { type: 'open-detail', lane: 'ble' };
        }
        if (hasClassToken(className, 'nodeLaneImu')) {
            return { type: 'expand-lane', lane: 'imu' };
        }
        if (hasClassToken(className, 'nodeLaneDsp')) {
            return { type: 'expand-lane', lane: 'dsp' };
        }
        if (hasClassToken(className, 'nodeLaneBle')) {
            return { type: 'expand-lane', lane: 'ble' };
        }
        if (hasClassToken(className, 'laneCloseImu')) {
            return { type: 'collapse-lane', lane: 'imu' };
        }
        if (hasClassToken(className, 'laneCloseDsp')) {
            return { type: 'collapse-lane', lane: 'dsp' };
        }
        if (hasClassToken(className, 'laneCloseBle')) {
            return { type: 'collapse-lane', lane: 'ble' };
        }
        if (hasClassToken(className, 'closeBtn')) {
            return { type: 'collapse' };
        }
        if (hasClassToken(className, 'nodeImu')) {
            return {
                type: 'expand',
                expandedFlow: 'imu'
            };
        }
        if (hasClassToken(className, 'nodeBle')) {
            return {
                type: 'expand',
                expandedFlow: 'ble'
            };
        }
        if (hasClassToken(className, 'nodeDsp')) {
            return {
                type: 'expand',
                expandedFlow: 'dsp'
            };
        }
        if (hasClassToken(className, 'nodeDspFlow')) {
            return {
                type: 'navigate',
                href: 'flow.html'
            };
        }
        return null;
    }

    return {
        createFlowchartState,
        transitionFlowchartState,
        buildMainFlowchartDefinition,
        getFlowchartActionFromClassName
    };
})); 
