const fs = require('fs');

let js = fs.readFileSync('script.js', 'utf8');
const idx = js.indexOf('let simpleFlowchartState');

if (idx !== -1) {
    js = js.substring(0, idx);
    js += `let simpleFlowchartState = typeof createSimpleFlowState === "function"
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
            <div class="simple-flow-detail-board">
                <div class="simple-flow-back-controls">
                    <button type="button" class="simple-flow-back-btn" data-flow-back>&#8592; \${getSimpleFlowTranslation('flow-back')}</button>
                </div>
                <div class="simple-flow-lanes">
                    \${model.lanes.map(lane => {
                        const isExpanded = lane.isExpanded;
                        const laneClass = \`simple-flow-lane \${isExpanded ? 'expanded' : 'collapsed'}\`;
                        
                        return \`
                            <div class="\${laneClass}" data-lane-id="\${lane.id}">
                                <div class="lane-header">
                                    <strong class="lane-title">\${getSimpleFlowTranslation(lane.titleKey)}</strong>
                                    <button type="button" class="lane-toggle-btn" data-flow-toggle-step="\${lane.id}">\${isExpanded ? '-' : '+'}</button>
                                </div>
                                \${isExpanded ? \`
                                    <div class="lane-content">
                                        \${lane.steps.map((step, index) => {
                                            const stepClasses = [
                                                "simple-flow-step",
                                                "is-detail-reveal",
                                                \`simple-flow-step-\${step.tone}\`,
                                                "lane-step-item"
                                            ].join(" ");
                                            
                                            const isLink = lane.id === 'dsp' && index === lane.steps.length - 1;
                                            const tagName = isLink ? "a" : "div";
                                            const attrs = isLink ? 'href="flow.html"' : '';
                                            const stepStyle = isLink ? 'cursor: pointer; background: var(--signal); text-decoration: none;' : '';
                                            
                                            return \`
                                                <\${tagName} class="\${stepClasses}" data-step-id="\${step.id}" \${attrs} style="\${stepStyle}">
                                                    <span class="simple-flow-step-index" data-step-index="\${step.id}">\${index + 1}</span>
                                                    <span class="simple-flow-step-label" data-step-label="\${step.id}">\${getSimpleFlowTranslation(step.labelKey)}</span>
                                                </\${tagName}>
                                                \${index < lane.steps.length - 1 ? \`<span class="simple-flow-arrow is-detail-reveal lane-arrow-down" data-arrow-after="\${step.id}" aria-hidden="true"></span>\` : ""}
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

    fs.writeFileSync('script.js', js);
}
