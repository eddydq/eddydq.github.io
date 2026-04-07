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
        "nav-architecture": "Architecture",
        "nav-specs": "Technical Specs",
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
        "overview-eyebrow": "System Architecture",
        "overview-h2": "A complete stack from raw PCB to algorithmic telemetry.",
        "overview-copy-h3": "Technical Foundations",
        "overview-copy-p1": "In modern sports, athletic performance relies on high-fidelity data. The challenge was building a sensor that is autonomous, low-cost, and extraordinarily compact.",
        "overview-copy-p2": "Initially prototyped on an ESP32, power requirements dictated a battery that compromised form factor. The transition to the Renesas DA14531MOD solved power constraints but required meticulous C firmware design to handle real-time IMU processing without floating-point hardware.",
        "overview-sports-h3": "Supported IMU Sources",
        "overview-sports-note": "* Handled via compile-time abstraction layer.",
        "features-eyebrow": "Technical Specs",
        "features-h2": "Firmware engineered for precision and power efficiency.",
        "feat-dsp-h3": "Q16.16 Fixed-Point DSP",
        "feat-dsp-p": "Autocorrelation-based period estimation built entirely using Q16.16 fixed-point math to bypass the Cortex-M0+ lack of FPU.",
        "feat-pipe-h3": "Algorithm Pipeline",
        "feat-pipe-p": "Features harmonic rejection to prevent half-rate lockouts, sub-sample parabolic interpolation for precision, and a Kalman filter for cold-start confirmation.",
        "feat-ble-h3": "BLE CSCP Spoofing",
        "feat-ble-p": "Broadcasts real-time paddle stroke rate as \"crank cadence\" using the BLE Cycling Speed & Cadence Profile (0x1816), enabling instant compatibility with Wahoo, Garmin, and Zwift.",
        "feat-console-h3": "Console & Diagnostics",
        "feat-console-p": "Includes a dedicated console mode (<code>CFG_PADDLING_PULSE_CONSOLE_MODE</code>) exposing a single-wire UART AT command interface for querying cadence, IMU status, and battery.",
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
        "nav-architecture": "Architecture",
        "nav-specs": "Spécifications",
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
        "overview-eyebrow": "Architecture du système",
        "overview-h2": "Une stack complète, du PCB brut à la télémétrie algorithmique.",
        "overview-copy-h3": "Fondations techniques",
        "overview-copy-p1": "Dans le sport moderne, la performance repose sur des données de haute fidélité. Le défi était de concevoir un capteur autonome, peu coûteux et extrêmement compact.",
        "overview-copy-p2": "Initialement prototypé sur ESP32, les besoins énergétiques imposaient une batterie trop volumineuse. Le choix du Renesas DA14531MOD a résolu ces contraintes mais a nécessité un firmware en C très optimisé pour traiter l'IMU en temps réel sans hardware à virgule flottante.",
        "overview-sports-h3": "Sources IMU supportées",
        "overview-sports-note": "* Géré via une couche d'abstraction à la compilation.",
        "features-eyebrow": "Spécifications techniques",
        "features-h2": "Un firmware conçu pour la précision et l'efficacité énergétique.",
        "feat-dsp-h3": "DSP Virgule Fixe Q16.16",
        "feat-dsp-p": "Estimation de la période par autocorrélation entièrement développée avec des mathématiques en virgule fixe Q16.16 pour pallier l'absence de FPU du Cortex-M0+.",
        "feat-pipe-h3": "Pipeline Algorithmique",
        "feat-pipe-p": "Rejet des harmoniques pour éviter les verrouillages à demi-fréquence, interpolation parabolique pour la précision et filtre de Kalman pour confirmer les démarrages à froid.",
        "feat-ble-h3": "Simulation BLE CSCP",
        "feat-ble-p": "Diffuse la cadence de pagayage comme une \"cadence de pédalage\" via le profil BLE Cycling Speed & Cadence (0x1816), compatible avec Wahoo, Garmin et Zwift.",
        "feat-console-h3": "Console & Diagnostics",
        "feat-console-p": "Inclut un mode console (<code>CFG_PADDLING_PULSE_CONSOLE_MODE</code>) exposant une interface AT UART pour interroger la cadence, l'état de l'IMU et la batterie.",
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
