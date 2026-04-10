const fs = require('fs');

const cssToAdd = `
/* Make the flowchart wrap instead of a single horizontal line */
.simple-flow-frame {
    min-height: 400px !important;
    align-items: flex-start !important;
}

.simple-flow-track {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 2.5rem;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
}

@media (max-width: 700px) {
    .simple-flow-frame {
        min-height: 350px !important;
    }
}
`;

fs.appendFileSync('styles.css', cssToAdd);
