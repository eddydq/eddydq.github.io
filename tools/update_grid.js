const fs = require('fs');

let js = fs.readFileSync('script.js', 'utf8');

const regex = /function buildSimpleFlowTrackMarkup\(model\) \{[\s\S]+?\}\n\nfunction ensureSimpleFlowchartStructure/;

const newLogic = `
function buildSimpleFlowTrackMarkup(model) {
    const itemsPerRow = window.innerWidth < 640 ? 2 : (window.innerWidth < 900 ? 3 : 4);
    
    let html = '<div class="simple-flow-grid" style="display: grid; grid-template-columns: repeat(' + (itemsPerRow * 2 - 1) + ', auto); justify-content: center; align-items: center; gap: 0.5rem; row-gap: 1.5rem; width: 100%; padding: 1rem 0;">';
    
    model.steps.forEach((step, index) => {
        const rowIdx = Math.floor(index / itemsPerRow);
        const indexInRow = index % itemsPerRow;
        const isEvenRow = rowIdx % 2 === 0;
        
        const cssRow = rowIdx * 2 + 1;
        const colIdx = isEvenRow ? indexInRow : (itemsPerRow - 1 - indexInRow);
        const cssCol = colIdx * 2 + 1;
        
        const stepClasses = [
            "simple-flow-step",
            \`simple-flow-step-\${step.tone}\`,
            step.isInteractive ? "is-expandable" : "",
            step.isSubStep ? "is-substep" : "",
            step.isExpanded ? "is-expanded-node" : "",
            step.isReturn ? "return-step" : ""
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
            
        html += \`
            <\${tagName} class="\${stepClasses}" data-step-id="\${step.id}" \${stepAttributes} style="grid-row: \${cssRow}; grid-column: \${cssCol}; margin: 0 auto; position: relative;">
                \${step.isSubStep || step.isReturn ? '' : \`<span class="simple-flow-step-index" data-step-index="\${step.id}">\${index + 1}</span>\`}
                <span class="simple-flow-step-label" data-step-label="\${step.id}">\${getSimpleFlowTranslation(step.labelKey)}</span>
                \${chipMarkup}
            </\${tagName}>
        \`;
        
        if (index < model.steps.length - 1) {
            const isLastInRow = indexInRow === itemsPerRow - 1;
            let arrowCssRow, arrowCssCol, arrowClass;
            
            if (isLastInRow) {
                arrowCssRow = rowIdx * 2 + 2;
                arrowCssCol = isEvenRow ? (itemsPerRow - 1) * 2 + 1 : 1;
                arrowClass = "arrow-down";
            } else {
                arrowCssRow = rowIdx * 2 + 1;
                arrowCssCol = isEvenRow ? (colIdx * 2 + 2) : (colIdx * 2);
                arrowClass = isEvenRow ? "arrow-right" : "arrow-left";
            }
            
            html += \`<span class="simple-flow-arrow \${arrowClass}" data-arrow-after="\${step.id}" aria-hidden="true" style="grid-row: \${arrowCssRow}; grid-column: \${arrowCssCol};"></span>\`;
        }
    });
    
    html += '</div>';
    return html;
}

function ensureSimpleFlowchartStructure`;

js = js.replace(regex, newLogic);

// Make it rerender on resize
if (!js.includes("window.addEventListener('resize'")) {
    js += `\nwindow.addEventListener('resize', () => {\n    syncSimpleFlowchart();\n});\n`;
}

fs.writeFileSync('script.js', js);
