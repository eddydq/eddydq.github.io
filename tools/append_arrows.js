const fs = require('fs');

const cssToAdd = `
.simple-flow-arrow.arrow-right::after {
    /* default is right */
}

.simple-flow-arrow.arrow-left::after {
    right: auto;
    left: -1px;
    border-left: none;
    border-right: 7px solid var(--navy);
}

.simple-flow-arrow.arrow-down {
    width: 2px;
    min-width: 2px;
    height: 2.5rem;
    background: var(--navy);
    margin: 0 auto;
}

.simple-flow-arrow.arrow-down::after {
    right: auto;
    left: 50%;
    top: auto;
    bottom: -1px;
    border-top: 7px solid var(--navy);
    border-bottom: none;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    transform: translateX(-50%);
}
`;

fs.appendFileSync('styles.css', cssToAdd);
