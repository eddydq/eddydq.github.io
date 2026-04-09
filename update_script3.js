const fs = require('fs');

let js = fs.readFileSync('script.js', 'utf8');

// Also add a translation for flow-step-loop
const newEn = `
        "flow-step-loop": "Return to Advertise",
        "flow-step-notify": "BLE notify",`;
const newFr = `
        "flow-step-loop": "Retour à la publicité",
        "flow-step-notify": "Notification BLE",`;

js = js.replace('"flow-step-notify": "BLE notify",', newEn);
js = js.replace('"flow-step-notify": "Notification BLE",', newFr);

const replacementLogic = `
let simpleFlowchartState = typeof createSimpleFlowState === "function"
    ? createSimpleFlowState()
    : { mode: 'inline', expandedLanes: [] };

function getSimpleFlowTranslation(key) {
    return translations[currentLanguage]?.[key] || translations.en?.[key] || key;
}

function buildSimpleFlowTrackMarkup(model) {
    return model.steps.map((step, index) => {
        if (step.isReturn) {
            return \`
                <div class="simple-flow-return-node">
                    <span class="simple-flow-arrow return-arrow-out" aria-hidden="true"></span>
                    <div class="simple-flow-step simple-flow-step-core return-step">
                        <span class="simple-flow-step-label">\${getSimpleFlowTranslation(step.labelKey)}</span>
                    </div>
                </div>
            \`;
        }

        const stepClasses = [
            "simple-flow-step",
            \`simple-flow-step-\${step.tone}\`,
            step.isInteractive ? "is-expandable" : "",
            step.isSubStep ? "is-substep" : "",
            step.isExpanded ? "is-expanded-node" : ""
        ].filter(Boolean).join(" ");
        
        const isLink = step.id === 'dsp-rpm';
        const tagName = isLink ? "a" : (step.isInteractive ? "button" : "div");
        let stepAttributes = step.isInteractive ? \`type="button" data-flow-toggle-step="\${step.laneId}"\` : "";
        if (isLink) {
            stepAttributes += ' href="flow.html" style="text-decoration: none;"';
        }
        
        const chipMarkup = step.isInteractive
            ? \`<span class="simple-flow-step-chip" aria-hidden="true">\${step.isExpanded ? '-' : '+'}</span>\`
            : "";
            
        const isArrowHidden = step.isSubStep && step.id === 'dsp-rpm' ? false : false;

        return \`
            <\${tagName} class="\${stepClasses}" data-step-id="\${step.id}" \${stepAttributes}>
                \${step.isSubStep ? '' : \`<span class="simple-flow-step-index" data-step-index="\${step.id}">\${index + 1}</span>\`}
                <span class="simple-flow-step-label" data-step-label="\${step.id}">\${getSimpleFlowTranslation(step.labelKey)}</span>
                \${chipMarkup}
            </\${tagName}>
            \${index < model.steps.length - 1 ? \`<span class="simple-flow-arrow" data-arrow-after="\${step.id}" aria-hidden="true"></span>\` : ""}
        \`;
    }).join("");
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
}

function toggleSimpleFlowchart(stepId) {
    if (typeof transitionSimpleFlowState !== "function") {
        return;
    }
    
    simpleFlowchartState = transitionSimpleFlowState(simpleFlowchartState, { type: "toggle_lane", laneId: stepId });
    syncSimpleFlowchart();
}

document.addEventListener("DOMContentLoaded", () => {
    syncSimpleFlowchart();
    document.getElementById("simple-flow-track")?.addEventListener("click", event => {
        const toggleStep = event.target.closest("[data-flow-toggle-step]");
        if (toggleStep) {
            toggleSimpleFlowchart(toggleStep.getAttribute("data-flow-toggle-step"));
        }
    });
});
`;

js = js.replace(/let simpleFlowchartState = typeof createSimpleFlowState[\s\S]+?\}\);\n\}\);/, replacementLogic);

fs.writeFileSync('script.js', js);
