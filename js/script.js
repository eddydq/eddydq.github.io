const siteConfig = {
    githubUrl: "https://github.com/eddydq/PaddlingPulse"
};

document.querySelectorAll('[data-config-link="github"]').forEach((link) => {
    link.setAttribute("href", siteConfig.githubUrl);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer");
});

const revealItems = document.querySelectorAll("[data-reveal]");

revealItems.forEach((item) => item.classList.add("reveal-ready"));

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        {
            threshold: 0.18,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    revealItems.forEach((item) => observer.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
}

const yearNode = document.getElementById("year");

if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
}

// Translations
const translations = {
    en: {
        "nav-specs": "Specifications",
        "nav-fw-arch": "Firmware Arch",
        "nav-hw-arch": "Hardware Arch",
        "nav-cad": "CAD",
        "nav-repo": "Repository",
        "nav-flow": "Flow Builder",
        "hero-eyebrow": "Embedded Hardware & Firmware",
        "hero-h1": "Engineering\n                    <span class=\"hero-accent\">clean cadence data</span>\n                    on the water.",
        "hero-text": "Paddling Pulse is an open-source hardware project centered on the Renesas DA14531MOD. It captures real-time stroke rate using custom PCBs, embedded C firmware, and fixed-point DSP algorithms.",
        "btn-github": "View GitHub Repo",
        "btn-architecture": "System Architecture",
        "panel-label": "Telemetry Stream",
        "panel-chip": "CSCP 0x1816",
        "grid-mcu": "MCU",
        "grid-mcu-desc": "DA14531MOD Cortex-M0+",
        "grid-protocol": "Protocol",
        "grid-protocol-desc": "BLE CSCP Profile",
        "grid-dsp": "DSP Algorithm",
        "grid-dsp-desc": "Fixed-Point Autocorrelation",
        "strip-constraint": "Constraint",
        "strip-constraint-desc": "Execute complex DSP algorithms without an FPU on a Cortex-M0+, maintaining extreme low power.",
        "strip-arch": "Architecture",
        "strip-arch-desc": "Pivoted from ESP32 to DA14531MOD to drastically reduce battery volume and system footprint.",
        "strip-integration": "Integration",
        "strip-integration-desc": "Exposes data via standard BLE Cycling Speed & Cadence Profile (CSCP) for Garmin and Wahoo support.",
        
        "specs-eyebrow": "Specifications",
        "specs-h2": "Engineered for precision and power efficiency.",
        "feat-cscp-h3": "BLE CSCP Protocol",
        "feat-cscp-p": "Broadcasts real-time paddle stroke rate as \"crank cadence\" using the BLE Cycling Speed & Cadence Profile (0x1816), enabling instant compatibility with Wahoo, Garmin, and Zwift.",
        "feat-battery-h3": "Autonomy",
        "feat-battery-p": "Optimized power consumption utilizing the ultra-low power states of the DA14531MOD, allowing for hundreds of hours of paddling on a single coin-cell battery.",
        "feat-size-h3": "Ultra-Compact Size",
        "feat-size-p": "Designed with an extremely small footprint to mount seamlessly on any paddle shaft without affecting weight balance or hydrodynamics.",

        "fw-arch-eyebrow": "Firmware Architecture",
        "fw-arch-h2": "A complete stack from raw PCB to algorithmic telemetry.",
        "fw-overall-h3": "System Flow",
        "fw-overall-p": "Prototype flow: 4 steps by default, with one summarized pipeline step that expands in place into four more internal steps.",
        "fw-imu-h3": "Sensor Integration",
        "fw-imu-p": "Abstracted state machines for I2C and BLE Central sensor acquisition.",
        "fw-cscp-h3": "BLE Initialization",
        "fw-cscp-p": "Setup of GATT services, advertising data, and CSCP profile broadcasting.",
        "fw-dsp-h3": "DSP Pipeline",
        "fw-dsp-p": "Q16.16 fixed-point math, low-pass filtering, and autocorrelation period estimation. Test the algorithm interactively in the <a href=\"flow-builder/\" style=\"text-decoration: underline; color: var(--water-strong);\">Flow Builder</a>.",
        "flowchart-back-btn": "Back to overview",
        "flowchart-hint": "Click the summarized pipeline block to open the four internal steps.",
        "flow-step-boot": "Boot firmware",
        "flow-step-sample": "Acquire samples",
        "flow-step-pipeline": "Cadence pipeline",
        "flow-step-window": "Window samples",
        "flow-step-filter": "Filter signal",
        "flow-step-detect": "Detect period",
        "flow-step-smooth": "Smooth cadence",
        
        
        "flow-step-loop": "Return to Advertise",
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

        "placeholder-overall-flow": "Overall Flowchart Placeholder",
        "placeholder-imu-flow": "IMU Connection Flowcharts Placeholder (MPU6050, LIS3DH, Polar)",
        "placeholder-cscp-flow": "CSCP Initialization Flowchart Placeholder",
        "placeholder-dsp-flow": "DSP Algorithm Flowchart Placeholder (Click to open Flow Builder)",

        "hw-arch-eyebrow": "Hardware Architecture",
        "hw-arch-h2": "Custom PCB Design and Component Selection",
        "hw-arch-p": "A highly compact design utilizing the DA14531MOD footprint, maximizing battery life and minimizing weight. The board layout isolates noisy digital paths from the sensitive IMU traces to ensure clean data capture on the water.",
        "hw-circuit-h3": "Schematics",
        "hw-pcb-h3": "Board Layout",
        "placeholder-circuit": "Circuit Diagram Placeholder",
        "placeholder-pcb": "PCB Layout Placeholder",
        
        "cad-eyebrow": "CAD & Enclosure",
        "cad-h2": "Waterproof Enclosure Design",
        "cad-p": "The physical housing is designed for water resistance and durability in harsh paddling conditions. Iterative 3D printed prototypes validated the O-ring seals and hydrodynamic shape for minimal drag.",
        "cad-exploded-h3": "Mechanical Assembly",
        "cad-components-h3": "Component Breakdown",
        "cad-comp-1": "<strong>Main Housing:</strong> 3D-printed hydrodynamic shell.",
        "cad-comp-2": "<strong>O-Ring Seal:</strong> Ensures complete water resistance.",
        "cad-comp-3": "<strong>PCB Mount:</strong> Friction-fit sled for the electronics.",
        "placeholder-exploded": "Exploded View Placeholder",
        
        "solar-eyebrow": "Solar",
        "solar-h2": "Solar Energy Harvesting",
        "solar-p": "Future integration of solar cells to extend operational battery life indefinitely.",

        "repo-eyebrow": "Repository",
        "repo-h2": "Explore the C source code, PCB schematics, and algorithmic models.",
        "repo-p": "The codebase demonstrates hardware constraints driving algorithmic creativity. Explore the IMU abstraction layer, fixed-point math implementations, and BLE service structuring on GitHub.",
        "btn-source": "View Source Code",
        "btn-top": "Back to top",
        "footer-text": "Paddling Pulse. Open hardware for cleaner paddling data.",
        
        "flow-title": "Algorithm Tester",
        "nav-back": "← Back to Site",
        "sidebar-title": "DSP Pipeline",
        "block-imu": "IMU Source (X/Y/Z)",
        "block-filter": "Low-Pass Filter",
        "block-harmonic": "Harmonic Rejection",
        "block-autocorr": "Autocorrelation",
        "block-kalman": "Kalman Filter",
        "block-output": "Cadence Output",
        "btn-run-sim": "Run Simulation",
        "graph-title": "Execution Outputs",
        "flow-status-loading": "Loading catalog...",
        "flow-status-ready": "Catalog ready",
        "flow-status-error": "Catalog failed to load",
        "flow-run-invalid": "Fix graph validation errors before running.",
        "flow-run-running": "Running native pipeline...",
        "flow-run-complete": "Native pipeline complete",
        "flow-run-error": "Native runtime failed"
    },
    fr: {
        "nav-specs": "Spécifications",
        "nav-fw-arch": "Arch. Firmware",
        "nav-hw-arch": "Arch. Matérielle",
        "nav-cad": "CAO",
        "nav-repo": "Dépôt",
        "nav-flow": "Flow Builder",
        "hero-eyebrow": "Hardware & Firmware Embarqué",
        "hero-h1": "Générer des\n                    <span class=\"hero-accent\">données de cadence fiables</span>\n                    sur l'eau.",
        "hero-text": "Paddling Pulse est un projet open-source axé sur le Renesas DA14531MOD. Il mesure la cadence de pagayage en temps réel à l'aide de PCB sur mesure, d'un firmware en C et d'algorithmes DSP en virgule fixe.",
        "btn-github": "Voir le dépôt GitHub",
        "btn-architecture": "Architecture du système",
        "panel-label": "Télémétrie",
        "panel-chip": "CSCP 0x1816",
        "grid-mcu": "MCU",
        "grid-mcu-desc": "DA14531MOD Cortex-M0+",
        "grid-protocol": "Protocole",
        "grid-protocol-desc": "Profil BLE CSCP",
        "grid-dsp": "Algorithme DSP",
        "grid-dsp-desc": "Autocorrélation en virgule fixe",
        "strip-constraint": "Contrainte",
        "strip-constraint-desc": "Exécuter des algorithmes DSP complexes sans FPU sur un Cortex-M0+, tout en minimisant la consommation énergétique.",
        "strip-arch": "Architecture",
        "strip-arch-desc": "Transition de l'ESP32 au DA14531MOD pour réduire drastiquement le volume de la batterie et l'empreinte du système.",
        "strip-integration": "Intégration",
        "strip-integration-desc": "Transmission des données via le profil BLE CSCP standard pour une compatibilité immédiate avec Garmin et Wahoo.",

        "specs-eyebrow": "Spécifications",
        "specs-h2": "Conçu pour la précision et l'efficacité énergétique.",
        "feat-cscp-h3": "Protocole BLE CSCP",
        "feat-cscp-p": "Diffuse la cadence de pagayage comme une \"cadence de pédalage\" via le profil BLE Cycling Speed & Cadence (0x1816), compatible avec Wahoo, Garmin et Zwift.",
        "feat-battery-h3": "Autonomie",
        "feat-battery-p": "Consommation d'énergie optimisée grâce aux états ultra-basse consommation du DA14531MOD, permettant des centaines d'heures de pagayage sur une seule pile bouton.",
        "feat-size-h3": "Taille Ultra-Compacte",
        "feat-size-p": "Conçu avec un encombrement extrêmement réduit pour se monter sans gêne sur n'importe quel manche de pagaie sans affecter l'équilibre ou l'hydrodynamisme.",

        "fw-arch-eyebrow": "Architecture Firmware",
        "fw-arch-h2": "Une stack complète, du PCB brut à la télémétrie algorithmique.",
        "fw-overall-h3": "Flux Système",
        "fw-overall-p": "Prototype de flux : 4 étapes par défaut, avec une étape pipeline résumée qui se développe sur place en quatre étapes internes.",
        "fw-imu-h3": "Intégration des Capteurs",
        "fw-imu-p": "Machines à états abstraites pour l'acquisition des capteurs I2C et BLE Central.",
        "fw-cscp-h3": "Initialisation BLE",
        "fw-cscp-p": "Configuration des services GATT, des données d'annonce et diffusion du profil CSCP.",
        "fw-dsp-h3": "Pipeline DSP",
        "fw-dsp-p": "Mathématiques à virgule fixe Q16.16, filtrage passe-bas et estimation de période par autocorrélation. Testez l'algorithme de façon interactive dans le <a href=\"flow-builder/\" style=\"text-decoration: underline; color: var(--water-strong);\">Flow Builder</a>.",
        "flowchart-back-btn": "Retour à la vue d'ensemble",
        "flowchart-hint": "Cliquez sur le bloc pipeline résumé pour ouvrir les quatre étapes internes.",
        "flow-step-boot": "Démarrage firmware",
        "flow-step-sample": "Acquérir les mesures",
        "flow-step-pipeline": "Pipeline cadence",
        "flow-step-window": "Fenêtrer les mesures",
        "flow-step-filter": "Filtrer le signal",
        "flow-step-detect": "Détecter la période",
        "flow-step-smooth": "Lisser la cadence",
        
        
        "flow-step-loop": "Retour à la publicité",
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

        "placeholder-overall-flow": "Espace Réservé : Diagramme de Flux Global",
        "placeholder-imu-flow": "Espace Réservé : Diagrammes de Connexion IMU (MPU6050, LIS3DH, Polar)",
        "placeholder-cscp-flow": "Espace Réservé : Diagramme d'Initialisation CSCP",
        "placeholder-dsp-flow": "Espace Réservé : Diagramme de l'Algorithme DSP (Cliquer pour ouvrir le Flow Builder)",

        "hw-arch-eyebrow": "Architecture Matérielle",
        "hw-arch-h2": "Conception de PCB sur mesure et sélection de composants",
        "hw-arch-p": "Un design extrêmement compact utilisant l'empreinte du DA14531MOD, maximisant l'autonomie et minimisant le poids. Le routage de la carte isole les pistes numériques bruyantes des signaux sensibles de l'IMU.",
        "hw-circuit-h3": "Schémas",
        "hw-pcb-h3": "Disposition de la Carte",
        "placeholder-circuit": "Espace Réservé : Schéma Électrique",
        "placeholder-pcb": "Espace Réservé : Disposition PCB",

        "cad-eyebrow": "CAO & Boîtier",
        "cad-h2": "Conception de boîtier étanche",
        "cad-p": "Le boîtier physique est conçu pour résister à l'eau et aux conditions de pagayage difficiles. Des prototypes itératifs imprimés en 3D ont validé l'étanchéité des joints toriques et la forme hydrodynamique.",
        "cad-exploded-h3": "Assemblage Mécanique",
        "cad-components-h3": "Détail des Composants",
        "cad-comp-1": "<strong>Boîtier Principal :</strong> Coque hydrodynamique imprimée en 3D.",
        "cad-comp-2": "<strong>Joint Torique :</strong> Assure une étanchéité complète.",
        "cad-comp-3": "<strong>Support PCB :</strong> Traîneau ajusté pour l'électronique.",
        "placeholder-exploded": "Espace Réservé : Vue Éclatée",

        "solar-eyebrow": "Solaire",
        "solar-h2": "Récupération d'Énergie Solaire",
        "solar-p": "Intégration future de cellules solaires pour étendre indéfiniment la durée de vie de la batterie.",

        "repo-eyebrow": "Dépôt",
        "repo-h2": "Explorez le code source C, les schémas PCB et les modèles.",
        "repo-p": "Le code démontre comment les contraintes matérielles stimulent la créativité algorithmique. Découvrez la couche d'abstraction IMU, l'implémentation en virgule fixe et les services BLE sur GitHub.",
        "btn-source": "Voir le code source",
        "btn-top": "Haut de page",
        "footer-text": "Paddling Pulse. Hardware open-source pour des données de pagayage plus claires.",
        
        "flow-title": "Testeur d'Algorithme",
        "nav-back": "← Retour au site",
        "sidebar-title": "Pipeline DSP",
        "block-imu": "Source IMU (X/Y/Z)",
        "block-filter": "Filtre Passe-Bas",
        "block-harmonic": "Rejet d'Harmonique",
        "block-autocorr": "Autocorrélation",
        "block-kalman": "Filtre de Kalman",
        "block-output": "Sortie de Cadence",
        "btn-run-sim": "Lancer la Simulation",
        "graph-title": "Sorties d'exécution",
        "flow-status-loading": "Chargement du catalogue...",
        "flow-status-ready": "Catalogue prêt",
        "flow-status-error": "Échec du chargement du catalogue",
        "flow-run-invalid": "Corrigez les erreurs de validation avant l'exécution.",
        "flow-run-running": "Exécution du pipeline natif...",
        "flow-run-complete": "Pipeline natif terminé",
        "flow-run-error": "Échec du runtime natif"
    }
};

let currentLanguage = "en";
const langButtons = document.querySelectorAll(".lang-btn");
const i18nElements = document.querySelectorAll("[data-i18n]");

function setLanguage(lang) {
    // Update active button
    langButtons.forEach(btn => {
        if (btn.dataset.lang === lang) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Update text
    const dict = translations[lang];
    if (!dict) return;
    currentLanguage = lang;

    i18nElements.forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });

    syncSimpleFlowchart();
}

langButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        setLanguage(btn.dataset.lang);
    });
});

// Simple HTML/CSS Firmware Flowchart Logic
const simpleFlowchartApi = window.SimpleFlowchart || {};
const createSimpleFlowState = simpleFlowchartApi.createSimpleFlowState;
const transitionSimpleFlowState = simpleFlowchartApi.transitionSimpleFlowState;
const buildSimpleFlowModel = simpleFlowchartApi.buildSimpleFlowModel;

let simpleFlowchartState = typeof createSimpleFlowState === "function"
    ? createSimpleFlowState()
    : { mode: 'inline', expandedLanes: [] };

function getSimpleFlowTranslation(key) {
    return translations[currentLanguage]?.[key] || translations.en?.[key] || key;
}


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
            `simple-flow-step-${step.tone}`,
            step.isInteractive ? "is-expandable" : "",
            step.isSubStep ? "is-substep" : "",
            step.isExpanded ? "is-expanded-node" : "",
            step.isReturn ? "return-step" : ""
        ].filter(Boolean).join(" ");
        
        const isLink = step.id === 'dsp-rpm';
        const tagName = isLink ? "a" : (step.isInteractive ? "button" : "div");
        let stepAttributes = step.isInteractive ? `type="button" data-flow-toggle-step="${step.laneId}"` : "";
        if (isLink) {
            stepAttributes += ' href="flow.html" style="text-decoration: none;"';
        }
        
        const chipMarkup = step.isInteractive
            ? `<span class="simple-flow-step-chip" aria-hidden="true">${step.isExpanded ? '-' : '+'}</span>`
            : "";
            
        html += `
            <${tagName} class="${stepClasses}" data-step-id="${step.id}" ${stepAttributes} style="grid-row: ${cssRow}; grid-column: ${cssCol}; margin: 0 auto; position: relative;">
                ${step.isSubStep || step.isReturn ? '' : `<span class="simple-flow-step-index" data-step-index="${step.id}">${index + 1}</span>`}
                <span class="simple-flow-step-label" data-step-label="${step.id}">${getSimpleFlowTranslation(step.labelKey)}</span>
                ${chipMarkup}
            </${tagName}>
        `;
        
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
            
            html += `<span class="simple-flow-arrow ${arrowClass}" data-arrow-after="${step.id}" aria-hidden="true" style="grid-row: ${arrowCssRow}; grid-column: ${arrowCssCol};"></span>`;
        }
    });
    
    html += '</div>';
    return html;
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


window.addEventListener('resize', () => {
    syncSimpleFlowchart();
});
