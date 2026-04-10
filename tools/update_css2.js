const fs = require('fs');

const cssToAdd = `
.simple-flow-return-node {
    display: flex;
    align-items: center;
    position: relative;
}

.return-arrow-out {
    width: 2rem;
    min-width: 2rem;
    position: relative;
}

.return-arrow-out::after {
    display: none;
}

.return-arrow-out::before {
    content: "";
    position: absolute;
    right: 0;
    top: 50%;
    width: 100%;
    height: 4.5rem;
    border: 2px solid var(--navy);
    border-left: none;
    border-bottom: none;
    transform: translateY(-100%);
    z-index: 1;
}

.return-step {
    border-style: dashed;
    background: transparent;
    box-shadow: none;
    opacity: 0.8;
}

.simple-flow-step.is-substep {
    background: #dcecf3;
    border-style: dotted;
    transform: scale(0.95);
}

.simple-flow-step.is-expanded-node {
    background: var(--navy);
    color: #fff;
}

.simple-flow-step.is-expanded-node .simple-flow-step-label,
.simple-flow-step.is-expanded-node .simple-flow-step-index {
    color: #fff;
    border-color: #fff;
}
`;

fs.appendFileSync('styles.css', cssToAdd);
