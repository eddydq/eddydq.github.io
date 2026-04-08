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
        "fw-overall-p": "Main execution loop outlining task scheduling and power management. Click the highlighted nodes above to expand process details.",
        "fw-imu-h3": "Sensor Integration",
        "fw-imu-p": "Abstracted state machines for I2C and BLE Central sensor acquisition.",
        "fw-cscp-h3": "BLE Initialization",
        "fw-cscp-p": "Setup of GATT services, advertising data, and CSCP profile broadcasting.",
        "fw-dsp-h3": "DSP Pipeline",
        "fw-dsp-p": "Q16.16 fixed-point math, low-pass filtering, and autocorrelation period estimation. Test the algorithm interactively in the <a href=\"flow.html\" style=\"text-decoration: underline; color: var(--water-strong);\">Flow Builder</a>.",
        "flowchart-back-btn": "Back to overview",
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
        "graph-title": "Calculated Stroke Rate"
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
        "fw-overall-p": "Boucle d'exécution principale détaillant l'ordonnancement des tâches et la gestion de l'alimentation. Cliquez sur les nœuds mis en évidence ci-dessus pour développer les détails du processus.",
        "fw-imu-h3": "Intégration des Capteurs",
        "fw-imu-p": "Machines à états abstraites pour l'acquisition des capteurs I2C et BLE Central.",
        "fw-cscp-h3": "Initialisation BLE",
        "fw-cscp-p": "Configuration des services GATT, des données d'annonce et diffusion du profil CSCP.",
        "fw-dsp-h3": "Pipeline DSP",
        "fw-dsp-p": "Mathématiques à virgule fixe Q16.16, filtrage passe-bas et estimation de période par autocorrélation. Testez l'algorithme de façon interactive dans le <a href=\"flow.html\" style=\"text-decoration: underline; color: var(--water-strong);\">Flow Builder</a>.",
        "flowchart-back-btn": "Retour à la vue d'ensemble",
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
        "graph-title": "Cadence Calculée"
    }
};

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

    i18nElements.forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });
}

langButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        setLanguage(btn.dataset.lang);
    });
});

// Interactive Mermaid Flowchart Logic
let flowchartState = null;
const workflowDiagram = window.WorkflowDiagram || {};
const createFlowchartState = workflowDiagram.createFlowchartState;
const transitionFlowchartState = workflowDiagram.transitionFlowchartState;
const buildMainFlowchartDefinition = workflowDiagram.buildMainFlowchartDefinition;
const getFlowchartActionFromClassName = workflowDiagram.getFlowchartActionFromClassName;

function syncFlowchartUi() {
    const shell = document.getElementById('flowchart-shell');
    const backBtn = document.getElementById('flowchart-back-btn');
    if (!shell || !backBtn) return;

    shell.classList.toggle('is-detail', flowchartState?.mode === 'detail');
    backBtn.hidden = flowchartState?.mode !== 'detail';
}

window.renderMainFlowchart = async function() {
    const container = document.getElementById('main-flowchart');
    if (!container) return;
    if (typeof buildMainFlowchartDefinition !== 'function') return;

    if (typeof createFlowchartState === 'function') {
        flowchartState = createFlowchartState(flowchartState);
    } else if (!flowchartState) {
        flowchartState = { mode: 'overview', openLanes: { imu: false, dsp: false, ble: false } };
    }

    syncFlowchartUi();
    container.removeAttribute('data-processed');
    container.innerHTML = buildMainFlowchartDefinition(flowchartState);
    try {
        await mermaid.run({
            querySelector: '#main-flowchart'
        });
    } catch(e) {
        console.error("Mermaid render error", e);
    }
};

async function rerenderFlowchart() {
    const shell = document.getElementById('flowchart-shell');
    shell?.classList.add('is-transitioning');
    await renderMainFlowchart();
    requestAnimationFrame(() => {
        shell?.classList.remove('is-transitioning');
    });
}

document.getElementById('flowchart-back-btn')?.addEventListener('click', function() {
    if (typeof transitionFlowchartState !== 'function') {
        return;
    }

    flowchartState = transitionFlowchartState(flowchartState, { type: 'back-overview' });
    rerenderFlowchart();
});

// SVG Click Event Delegation
document.addEventListener('click', function(e) {
    const flowchartContainer = document.getElementById('flowchart-container');
    if (!flowchartContainer || !flowchartContainer.contains(e.target)) {
        return;
    }

    let target = e.target;

    while (target && target !== document) {
        if (target.getAttribute) {
            const action = typeof getFlowchartActionFromClassName === 'function'
                ? getFlowchartActionFromClassName(target.getAttribute('class') || '')
                : null;

            if (action?.type === 'navigate') {
                window.location.href = action.href;
                return;
            }

            if (action && typeof transitionFlowchartState === 'function') {
                flowchartState = transitionFlowchartState(flowchartState, action);
                rerenderFlowchart();
                return;
            }
        }
        target = target.parentNode;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('main-flowchart')) {
        if (typeof createFlowchartState === 'function') {
            flowchartState = createFlowchartState();
        }
        renderMainFlowchart();
    }
});
