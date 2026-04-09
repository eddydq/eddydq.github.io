const fs = require('fs');

let js = fs.readFileSync('script.js', 'utf8');

// 1. Add translations
const newEn = `
        "flow-step-notify": "BLE notify",
        
        "flow-step-ble-adv": "BLE advertise",
        "flow-step-client-conn": "Client connects",
        "flow-step-csc-en": "CSC notifications enabled",
        "flow-step-sensor-in": "Sensor input",
        "flow-step-stroke-est": "Stroke estimate",
        "flow-step-ble-out": "BLE cadence out",

        "lane-imu": "Sensor / IMU",
        "flow-step-imu-src": "IMU source",
        "flow-step-imu-init": "Driver init",
        "flow-step-imu-start": "Start acquisition",
        "flow-step-imu-proc": "Periodic process",
        "flow-step-imu-push": "Push samples",

        "lane-dsp": "DSP / Stroke Rate",
        "flow-step-dsp-store": "Sample window",
        "flow-step-dsp-auto": "Autocorrelation",
        "flow-step-dsp-guard": "Confidence guard",
        "flow-step-dsp-kalman": "Kalman smoothing",
        "flow-step-dsp-rpm": "Cadence RPM",

        "lane-ble": "BLE / CSCP",
        "flow-step-ble-start": "pipeline_start()",
        "flow-step-ble-timer": "CSCP timer",
        "flow-step-ble-notify": "Cadence notify",

        "flow-back": "Back to overview",
`;

const newFr = `
        "flow-step-notify": "Notification BLE",
        
        "flow-step-ble-adv": "Publicité BLE",
        "flow-step-client-conn": "Connexion client",
        "flow-step-csc-en": "Notifications CSC",
        "flow-step-sensor-in": "Entrée capteur",
        "flow-step-stroke-est": "Estimation cadence",
        "flow-step-ble-out": "Sortie cadence BLE",

        "lane-imu": "Capteur / IMU",
        "flow-step-imu-src": "Source IMU",
        "flow-step-imu-init": "Init. pilote",
        "flow-step-imu-start": "Acquisition",
        "flow-step-imu-proc": "Processus périodique",
        "flow-step-imu-push": "Pousser données",

        "lane-dsp": "DSP / Cadence",
        "flow-step-dsp-store": "Fenêtre d'échantillons",
        "flow-step-dsp-auto": "Autocorrélation",
        "flow-step-dsp-guard": "Garde confiance",
        "flow-step-dsp-kalman": "Lissage Kalman",
        "flow-step-dsp-rpm": "Sortie RPM",

        "lane-ble": "BLE / CSCP",
        "flow-step-ble-start": "pipeline_start()",
        "flow-step-ble-timer": "Timer CSCP",
        "flow-step-ble-notify": "Notification cadence",

        "flow-back": "Retour à la vue d'ensemble",
`;

js = js.replace('"flow-step-notify": "BLE notify",', newEn);
js = js.replace('"flow-step-notify": "Notification BLE",', newFr);

const replacementLogic = `
let simpleFlowchartState = typeof createSimpleFlowState === "function"
    ? createSimpleFlowState()
    : { mode: 'overview', expandedLanes: [] };

function getSimpleFlowTranslation(key) {
    return translations[currentLanguage]?.[key] || translations.en?.[key] || key;
}

function buildSimpleFlowTrackMarkup(model) {
    if (model.mode === 'overview') {
        return model.overviewSteps.map((step, index) => {
            const stepClasses = [
                "simple-flow-step",
                \`simple-flow-step-\${step.tone}\`,
                step.isInteractive ? "is-expandable" : ""
            ].filter(Boolean).join(" ");
            const tagName = step.isInteractive ? "button" : "div";
            const stepAttributes = step.isInteractive
                ? \`type="button" data-flow-toggle-step="\${step.laneId}"\`
                : "";
            const chipMarkup = step.isInteractive
                ? '<span class="simple-flow-step-chip" aria-hidden="true">+</span>'
                : "";
            const arrowClasses = "simple-flow-arrow";

            return \`
                <\${tagName} class="\${stepClasses}" data-step-id="\${step.id}" \${stepAttributes}>
                    <span class="simple-flow-step-index" data-step-index="\${step.id}">\${index + 1}</span>
                    <span class="simple-flow-step-label" data-step-label="\${step.id}">\${getSimpleFlowTranslation(step.labelKey)}</span>
                    \${chipMarkup}
                </\${tagName}>
                \${index < model.overviewSteps.length - 1 ? \`<span class="\${arrowClasses}" data-arrow-after="\${step.id}" aria-hidden="true"></span>\` : ""}
            \`;
        }).join("");
    } else {
        return \`
            <div class="simple-flow-detail-board" style="display: flex; flex-direction: column; width: 100%; gap: 1rem;">
                <div class="simple-flow-back-controls" style="margin-bottom: 0.5rem;">
                    <button type="button" class="simple-flow-back-btn" data-flow-back style="background: none; border: 1px solid var(--navy); padding: 0.25rem 0.5rem; font-weight: bold; cursor: pointer; color: var(--navy);">&#8592; \${getSimpleFlowTranslation('flow-back')}</button>
                </div>
                <div class="simple-flow-lanes" style="display: flex; gap: 1rem; width: 100%;">
                    \${model.lanes.map(lane => {
                        const isExpanded = lane.isExpanded;
                        const laneStyle = isExpanded ? "flex: 2; border: 2px solid var(--navy); padding: 0.5rem; background: var(--mist); transition: all 0.3s ease;" : "flex: 1; border: 2px dashed var(--navy); padding: 0.5rem; opacity: 0.7; transition: all 0.3s ease;";
                        
                        return \`
                            <div class="simple-flow-lane" data-lane-id="\${lane.id}" style="\${laneStyle}">
                                <div class="lane-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                    <strong class="lane-title" style="font-size: 0.85rem; color: var(--navy);">\${getSimpleFlowTranslation(lane.titleKey)}</strong>
                                    <button type="button" class="lane-toggle-btn" data-flow-toggle-step="\${lane.id}" style="cursor:pointer; background: var(--navy); color: #fff; border:none; padding: 0.2rem 0.5rem;">\${isExpanded ? '-' : '+'}</button>
                                </div>
                                \${isExpanded ? \`
                                    <div class="lane-content" style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        \${lane.steps.map((step, index) => {
                                            const stepClasses = [
                                                "simple-flow-step",
                                                "is-detail-reveal",
                                                \`simple-flow-step-\${step.tone}\`
                                            ].join(" ");
                                            
                                            const isLink = lane.id === 'dsp' && index === lane.steps.length - 1;
                                            const tagName = isLink ? "a" : "div";
                                            const attrs = isLink ? 'href="flow.html"' : '';
                                            const stepStyle = isLink ? 'cursor: pointer; background: var(--signal); text-decoration: none;' : '';
                                            
                                            return \`
                                                <\${tagName} class="\${stepClasses}" data-step-id="\${step.id}" \${attrs} style="width:100%; min-height: 4rem; \${stepStyle}">
                                                    <span class="simple-flow-step-index" data-step-index="\${step.id}">\${index + 1}</span>
                                                    <span class="simple-flow-step-label" data-step-label="\${step.id}">\${getSimpleFlowTranslation(step.labelKey)}</span>
                                                </\${tagName}>
                                                \${index < lane.steps.length - 1 ? \`<span class="simple-flow-arrow is-detail-reveal" data-arrow-after="\${step.id}" aria-hidden="true" style="transform: rotate(90deg); margin: 0 auto; min-width: 2rem;"></span>\` : ""}
                                            \`;
                                        }).join("")}
                                    </div>
                                \` : ''}
                            </div>
                        \`;
                    }).join("")}
                </div>
            </div>
        \`;
    }
}

function ensureSimpleFlowchartStructure(track) {
    if (!track || typeof buildSimpleFlowModel !== "function") {
        return;
    }
    const model = buildSimpleFlowModel(simpleFlowchartState);
    track.innerHTML = buildSimpleFlowTrackMarkup(model);
}

function syncSimpleFlowchart() {
    const root = document.getElementById("simple-flowchart");
    const track = document.getElementById("simple-flow-track");

    if (!root || !track || typeof buildSimpleFlowModel !== "function") {
        return;
    }

    ensureSimpleFlowchartStructure(track);

    const model = buildSimpleFlowModel(simpleFlowchartState);
    root.classList.toggle("is-expanded", model.mode === 'detail');
}

function toggleSimpleFlowchart(stepId) {
    if (typeof transitionSimpleFlowState !== "function") {
        return;
    }
    
    if (simpleFlowchartState.mode === 'overview') {
        simpleFlowchartState = transitionSimpleFlowState(simpleFlowchartState, { type: "open_detail_view", laneId: stepId });
    } else {
        simpleFlowchartState = transitionSimpleFlowState(simpleFlowchartState, { type: "toggle_lane", laneId: stepId });
    }
    
    syncSimpleFlowchart();
}

function returnToOverview() {
    if (typeof transitionSimpleFlowState !== "function") {
        return;
    }
    simpleFlowchartState = transitionSimpleFlowState(simpleFlowchartState, { type: "return_to_overview" });
    syncSimpleFlowchart();
}

document.addEventListener("DOMContentLoaded", () => {
    syncSimpleFlowchart();
    document.getElementById("simple-flow-track")?.addEventListener("click", event => {
        const toggleStep = event.target.closest("[data-flow-toggle-step]");
        if (toggleStep) {
            toggleSimpleFlowchart(toggleStep.getAttribute("data-flow-toggle-step"));
            return;
        }
        
        const backBtn = event.target.closest("[data-flow-back]");
        if (backBtn) {
            returnToOverview();
        }
    });
});
`;

js = js.replace(/let simpleFlowchartState = typeof createSimpleFlowState[\s\S]+?\}\);\n\}\);/, replacementLogic);

fs.writeFileSync('script.js', js);
