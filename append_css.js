const fs = require('fs');

const cssToAdd = `
/* Firmware Flow Detail Mode */
.simple-flow-detail-board {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 1rem;
    animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}

.simple-flow-back-controls {
    margin-bottom: 0.5rem;
}

.simple-flow-back-btn {
    background: none;
    border: 2px solid var(--navy);
    padding: 0.35rem 0.75rem;
    font-weight: bold;
    cursor: pointer;
    color: var(--navy);
    font-size: 0.85rem;
    transition: all 0.2s;
    box-shadow: var(--hard-shadow-sm);
}

.simple-flow-back-btn:hover {
    background: var(--navy);
    color: #fff;
}

.simple-flow-lanes {
    display: flex;
    gap: 1rem;
    width: 100%;
    align-items: stretch;
}

.simple-flow-lane {
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.simple-flow-lane.expanded {
    flex: 2;
    border: 2px solid var(--navy);
    padding: 0.5rem;
    background: var(--mist);
    box-shadow: var(--hard-shadow-sm);
}

.simple-flow-lane.collapsed {
    flex: 1;
    border: 2px dashed var(--navy);
    padding: 0.5rem;
    opacity: 0.6;
    background: transparent;
}

.simple-flow-lane.collapsed:hover {
    opacity: 0.9;
    border-style: solid;
}

.lane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.lane-title {
    font-size: 0.85rem;
    color: var(--navy);
}

.lane-toggle-btn {
    cursor: pointer;
    background: var(--navy);
    color: #fff;
    border: none;
    padding: 0.15rem 0.5rem;
    font-weight: bold;
}

.lane-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-grow: 1;
}

.lane-step-item {
    width: 100%;
    min-height: 4rem;
    flex-direction: row;
    align-items: center;
    padding: 0.4rem;
}

.lane-arrow-down {
    transform: rotate(90deg);
    margin: 0 auto;
    min-width: 1.5rem;
    height: 1.5rem;
    background: transparent;
}

.lane-arrow-down::after {
    top: 50%;
    transform: translateY(-50%);
}

@media (max-width: 700px) {
    .simple-flow-lanes {
        flex-direction: column;
    }
}
`;

fs.appendFileSync('styles.css', cssToAdd);
