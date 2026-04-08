(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.WorkflowDiagram = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const LANE_KEYS = ['imu', 'dsp', 'ble'];
    const VALID_EXPANDED_FLOWS = new Set(['imu', 'ble', 'dsp']);
    const SELECTED_LANE_KEY = '__flowchartSelectedLane';

    function defineSelectedLane(state, selectedLane) {
        Object.defineProperty(state, SELECTED_LANE_KEY, {
            value: VALID_EXPANDED_FLOWS.has(selectedLane) ? selectedLane : null,
            enumerable: false,
            configurable: true,
            writable: true
        });

        return state;
    }

    function getSelectedLane(state) {
        return state && state[SELECTED_LANE_KEY];
    }

    function findFirstOpenLane(openLanes, excludedLane) {
        for (const lane of LANE_KEYS) {
            if (lane !== excludedLane && openLanes[lane]) {
                return lane;
            }
        }

        return null;
    }

    function createFlowchartState(overrides = {}) {
        const normalizedOverrides = overrides || {};

        return defineSelectedLane({
            mode: normalizedOverrides.mode === 'detail' ? 'detail' : 'overview',
            openLanes: {
                imu: Boolean(normalizedOverrides.openLanes?.imu),
                dsp: Boolean(normalizedOverrides.openLanes?.dsp),
                ble: Boolean(normalizedOverrides.openLanes?.ble)
            }
        }, normalizedOverrides[SELECTED_LANE_KEY]);
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
                },
                [SELECTED_LANE_KEY]: action.lane
            });
        }

        if (action.type === 'expand-lane') {
            return createFlowchartState({
                mode: 'detail',
                openLanes: {
                    ...current.openLanes,
                    [action.lane]: true
                },
                [SELECTED_LANE_KEY]: action.lane
            });
        }

        if (action.type === 'collapse-lane') {
            const openLanes = {
                ...current.openLanes,
                [action.lane]: false
            };
            let selectedLane = getSelectedLane(current);

            if (selectedLane === action.lane || !selectedLane) {
                selectedLane = findFirstOpenLane(openLanes, action.lane);
            }

            if (!selectedLane) {
                return createFlowchartState();
            }

            return createFlowchartState({
                mode: 'detail',
                openLanes,
                [SELECTED_LANE_KEY]: selectedLane
            });
        }

        return current;
    }

    function normalizeFlowchartRenderState(viewStateOrExpandedFlow) {
        if (
            viewStateOrExpandedFlow === null ||
            typeof viewStateOrExpandedFlow === 'undefined'
        ) {
            return createFlowchartState();
        }

        if (typeof viewStateOrExpandedFlow === 'string') {
            if (!VALID_EXPANDED_FLOWS.has(viewStateOrExpandedFlow)) {
                return createFlowchartState();
            }

            return createFlowchartState({
                mode: 'detail',
                openLanes: {
                    imu: viewStateOrExpandedFlow === 'imu',
                    dsp: viewStateOrExpandedFlow === 'dsp',
                    ble: viewStateOrExpandedFlow === 'ble'
                },
                [SELECTED_LANE_KEY]: viewStateOrExpandedFlow
            });
        }

        return createFlowchartState(viewStateOrExpandedFlow);
    }

    function buildOverviewDefinition() {
        return [
            'graph LR;',
            'Boot([Boot]):::overviewNode --> Adv([BLE advertise]):::overviewNode;',
            'Adv --> Link([Client connects]):::overviewNode;',
            'Link --> Ntf([CSC notifications enabled]):::overviewNode;',
            'Ntf --> Imu([Sensor input]);',
            'Imu --> Dsp([Stroke estimate]);',
            'Dsp --> Ble([BLE cadence out]);',
            'Ble -. restart .-> Adv;',
            'class Imu nodeOverviewImu,nodeImu;',
            'class Dsp nodeOverviewDsp,nodeDsp;',
            'class Ble nodeOverviewBle,nodeBle;',
            'classDef overviewNode fill:#f3f5f7,stroke:#172b45,stroke-width:2px,color:#122133;',
            'classDef nodeImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeDsp fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
            'classDef nodeBle fill:#b8d6c3,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeOverviewImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeOverviewDsp fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
            'classDef nodeOverviewBle fill:#b8d6c3,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;'
        ].join('\n');
    }

    function buildDetailDefinition(state) {
        const { openLanes } = createFlowchartState(state);
        const imuEntryNode = openLanes.imu ? 'ImuSelect' : 'ImuCompact';
        const imuOutputNode = openLanes.imu ? 'ImuPush' : 'ImuCompact';
        const dspEntryNode = openLanes.dsp ? 'DspStore' : 'DspCompact';
        const dspOutputNode = 'DspOut';
        const bleEntryNode = openLanes.ble ? 'BleAdv' : 'BleCompact';
        const bleTickNode = openLanes.ble ? 'BleTick' : 'BleCompact';
        const bleOutputNode = openLanes.ble ? 'BleSend' : 'BleCompact';
        const imuLane = openLanes.imu
            ? 'ImuClose([ - ]); ImuSelect([Compile-time source]); ImuInit([Driver init]); ImuRun([Acquire samples]); ImuPush([Push to sample store]); ImuClose --> ImuSelect --> ImuInit --> ImuRun --> ImuPush;'
            : 'ImuCompact([Sensor input]);';
        const dspLane = openLanes.dsp
            ? 'DspClose([ - ]); DspStore([Sample store]); DspAuto([Autocorrelation]); DspGuard([Confidence + harmonic guard]); DspKalman([Kalman smoothing]); DspOut([Cadence RPM / Flow Builder]):::nodeDspFlow; DspClose --> DspStore --> DspAuto --> DspGuard --> DspKalman --> DspOut;'
            : 'DspCompact([Stroke estimate]); DspStore([Sample store]); DspCompact -. expand .-> DspStore; DspStore --> DspOut([Cadence RPM / Flow Builder]):::nodeDspFlow;';
        const bleLane = openLanes.ble
            ? 'BleClose([ - ]); BleAdv([BLE advertise]); BleConn([Client connects]); BleGate([CSC notifications enabled]); BleStart([pipeline_start()]); BleTick([CSC measurement timer]); BleSend([CSC notify]); BleClose --> BleAdv --> BleConn --> BleGate --> BleStart --> BleTick --> BleSend;'
            : 'BleCompact([BLE cadence out]);';

        const lines = [
            'graph LR;',
            'Back([Back]);',
            'subgraph LANE_IMU [Sensor / IMU]',
            imuLane,
            'end',
            'subgraph LANE_DSP [DSP / Stroke Rate]',
            dspLane,
            'end',
            'subgraph LANE_BLE [BLE / CSCP]',
            bleLane,
            'end',
            `Back --> ${imuEntryNode};`,
            `Back --> ${dspEntryNode};`,
            `Back --> ${bleEntryNode};`,
            `${imuOutputNode} -. samples .-> DspStore;`,
            `${dspOutputNode} -. cadence .-> ${bleTickNode};`,
            `${bleOutputNode} -. stop/restart .-> ${bleEntryNode};`,
            'class Back detailBack,closeBtn;',
            'class DspOut nodeDspFlow;',
            'classDef detailBack fill:#f3f5f7,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeLaneImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeLaneDsp fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
            'classDef nodeLaneBle fill:#b8d6c3,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef nodeDsp fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
            'classDef nodeBle fill:#b8d6c3,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;',
            'classDef closeBtn fill:#e11d48,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;',
            'classDef nodeDspFlow fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;'
        ];

        if (openLanes.imu) {
            lines.push('class ImuClose laneCloseImu,closeBtn;');
        } else {
            lines.push('class ImuCompact nodeLaneImu,nodeImu;');
        }

        if (openLanes.dsp) {
            lines.push('class DspClose laneCloseDsp,closeBtn;');
        } else {
            lines.push('class DspCompact nodeLaneDsp,nodeDsp;');
        }

        if (openLanes.ble) {
            lines.push('class BleClose laneCloseBle,closeBtn;');
        } else {
            lines.push('class BleCompact nodeLaneBle,nodeBle;');
        }

        if (openLanes.imu) {
            lines.push('classDef laneCloseImu fill:#e11d48,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;');
        }

        if (openLanes.dsp) {
            lines.push('classDef laneCloseDsp fill:#e11d48,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;');
        }

        if (openLanes.ble) {
            lines.push('classDef laneCloseBle fill:#e11d48,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;');
        }

        return lines.join('\n');
    }

    function buildMainFlowchartDefinition(viewStateOrExpandedFlow) {
        const state = normalizeFlowchartRenderState(viewStateOrExpandedFlow);

        return state.mode === 'detail'
            ? buildDetailDefinition(state)
            : buildOverviewDefinition();
    }

    function hasClassToken(className, token) {
        return typeof className === 'string' && className.split(/\s+/).includes(token);
    }

    function getFlowchartActionFromClassName(className) {
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
