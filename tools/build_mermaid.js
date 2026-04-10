const fs = require('fs');

let expandedFlow = 'imu';
let m = "graph TD;\n";
m += "Init((Boot)) --> I2C[I2C Init]:::nodeImu;\n";

// Block 1: IMU
if (expandedFlow === 'imu') {
    m += `
    subgraph IMU_Sub [IMU Integration]
        direction TD
        IMU_Close(( - )):::closeBtn
        Start_IMU((Start Driver)) --> Type{Sensor Type?};
        Type -->|LIS3DH| InitL[Write CTRL_REG1];
        InitL --> CfgL[Set ODR and Range];
        CfgL --> IntL[Enable INT1];
        IntL --> LoopL((Wait INT1));
        Type -->|MPU6050| InitM[Write PWR_MGMT_1];
        InitM --> CfgM[Set LPF and Rate];
        CfgM --> LoopM((Timer Polling));
        Type -->|Polar| Scan[Scan Polar];
        Scan --> ConnectP[Connect MAC];
        ConnectP --> Notif[Enable Notifications];
        Notif --> LoopP((Wait BLE Evt));
    end
    I2C --> Start_IMU;
    `;
} else {
    m += "I2C --> IMU[IMU Wakeup]:::nodeImu;\n";
}

// Bridge IMU to BLE
const imuExitNodes = expandedFlow === 'imu' ? ['LoopL', 'LoopM', 'LoopP'] : ['IMU'];
const bleEntryNode = expandedFlow === 'ble' ? 'Start_BLE' : 'BLE';

imuExitNodes.forEach(exit => {
    m += `${exit} --> ${bleEntryNode};\n`;
});

// Block 2: BLE
if (expandedFlow === 'ble') {
    m += `
    subgraph BLE_Sub [BLE Initialization]
        direction TD
        BLE_Close(( - )):::closeBtn
        Start_BLE((BLE App Init)) --> DB[Create CSCP DB];
        DB --> Profile[Load Profile 0x1816];
        Profile --> Gap[Set GAP params];
        Gap --> Adv_Sub[Start Advertising];
        Adv_Sub --> Peer[Peer Connected];
        Peer --> Setup[Setup Connection Params];
        Setup --> CCCD[Enable CCCD Notif];
        CCCD --> Run((Ready to send SPM));
    end
    `;
} else {
    m += `
    BLE[BLE Stack Init]:::nodeBle --> Adv[Start Advertising]:::nodeBle;
    Adv --> Connect{Connected?};
    Connect -->|Yes| CSCP[Start CSCP Notif]:::nodeBle;
    Connect -->|No| Adv;
    `;
}

// Bridge BLE to Sleep
const bleExitNodes = expandedFlow === 'ble' ? ['Run'] : ['CSCP'];
bleExitNodes.forEach(exit => {
    m += `${exit} --> Sleep[Extended Sleep];\n`;
});

m += "Sleep -->|Timer/INT| Wake[Wakeup and Read IMU]:::nodeImu;\n";

// Block 3: DSP
const dspEntryNode = expandedFlow === 'dsp' ? 'Input' : 'DSP';
m += `Wake --> ${dspEntryNode};\n`;

if (expandedFlow === 'dsp') {
    m += `
    subgraph DSP_Sub [DSP Pipeline]
        direction TD
        DSP_Close(( - )):::closeBtn
        Input((Raw Accel)) --> LP[Low Pass Filter];
        LP --> Win[Autocorr Window];
        Win --> ACF[Compute ACF];
        ACF --> Peak[Find ACF Peaks];
        Peak --> HR[Harmonic Rejection];
        HR --> Interp[Parabolic Interp];
        Interp --> Kalman[Kalman Filter];
        Kalman --> Output((SPM Output Click to Test)):::nodeDspFlow;
    end
    `;
} else {
    m += `DSP[Run DSP Pipeline]:::nodeDsp;\n`;
}

// Bridge DSP to Send
const dspExitNode = expandedFlow === 'dsp' ? 'Output' : 'DSP';
m += `${dspExitNode} --> Send[Notify Cadence];\n`;
m += "Send --> Sleep;\n";

if (expandedFlow === 'imu') m += "style IMU_Sub fill:transparent,stroke:#172b45,stroke-width:2px,stroke-dasharray: 5 5;\n";
if (expandedFlow === 'ble') m += "style BLE_Sub fill:transparent,stroke:#172b45,stroke-width:2px,stroke-dasharray: 5 5;\n";
if (expandedFlow === 'dsp') m += "style DSP_Sub fill:transparent,stroke:#172b45,stroke-width:2px,stroke-dasharray: 5 5;\n";

m += `
classDef nodeImu fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;
classDef nodeBle fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;
classDef nodeDsp fill:#7caec2,stroke:#172b45,stroke-width:2px,color:#122133,cursor:pointer;
classDef nodeDspFlow fill:#4f8ea8,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;
classDef closeBtn fill:#e11d48,stroke:#172b45,stroke-width:2px,color:#fff,cursor:pointer;
`;

fs.writeFileSync('mermaid_test.txt', m);
