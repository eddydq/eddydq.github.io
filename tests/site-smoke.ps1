$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$requiredFiles = @(
    "index.html",
    "styles.css",
    "script.js",
    "simple-flowchart.js",
    "assets/logo.svg"
)

foreach ($path in $requiredFiles) {
    $fullPath = Join-Path $root $path
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing required file: $path"
    }
}

$html = Get-Content (Join-Path $root "index.html") -Raw
$css = Get-Content (Join-Path $root "styles.css") -Raw
$js = Get-Content (Join-Path $root "script.js") -Raw
$flowHtmlPath = Join-Path $root "flow-builder/index.html"
if (-not (Test-Path -LiteralPath $flowHtmlPath)) {
    throw "Missing required file: flow-builder/index.html"
}
$flowHtml = Get-Content $flowHtmlPath -Raw

if ($html -notmatch "Paddling Pulse") {
    throw "Expected the site title to mention Paddling Pulse."
}

if ($html -notmatch "styles\.css" -or $html -notmatch "script\.js" -or $html -notmatch "simple-flowchart\.js") {
    throw "Expected index.html to reference styles.css, simple-flowchart.js, and script.js."
}

if ($html -notmatch "data-reveal") {
    throw "Expected reveal hooks in the markup."
}

if ($html -match 'mermaid@10' -or $html -match 'workflow-diagram\.js') {
    throw "Expected the firmware flow prototype to remove Mermaid-specific page dependencies."
}

if ($html -notmatch 'id="simple-flowchart"') {
    throw "Expected simple flowchart root container in index.html."
}

if ($html -notmatch 'id="simple-flow-track"') {
    throw "Expected simple flowchart track container in index.html."
}

if ($html -match '<div class="simple-flowchart"[^>]*style=' -or $html -match '<div class="simple-flow-frame"[^>]*style=') {
    throw "Expected simple flowchart layout to avoid inline styles."
}

if ($css -notmatch "--navy") {
    throw "Expected a color system in styles.css."
}

if ($css -notmatch '\.simple-flowchart' -or $css -notmatch '\.simple-flow-frame') {
    throw "Expected simple flowchart container styles in styles.css."
}

if ($css -notmatch '\.simple-flow-track' -or $css -notmatch '\.simple-flow-step' -or $css -notmatch '\.simple-flow-arrow') {
    throw "Expected simple flowchart track, step, and arrow styles in styles.css."
}

if ($css -match '\.simple-flow-frame\s*\{[^}]*overflow:\s*hidden') {
    throw "Expected simple flowchart frame to avoid clipping overflow on narrow screens."
}

if ($css -notmatch '\.simple-flow-frame\s*\{[^}]*overflow:\s*(auto|scroll)') {
    throw "Expected the simple flowchart to provide contained scrolling instead of clipping."
}

if ($css -notmatch '\.simple-flow-step\s*\{[^}]*transition:\s*[^}]*(width|min-width|max-width|transform|opacity)' -or $css -notmatch '\.simple-flow-arrow\s*\{[^}]*transition:\s*[^}]*(width|min-width|transform|opacity)') {
    throw "Expected transition styling on the simple flowchart step and arrow rules."
}

if ($css -notmatch '\.simple-flowchart\.is-expanded') {
    throw "Expected expanded-state simple flowchart styling in styles.css."
}

if ($css -notmatch '\.simple-flow-step\.is-detail-reveal' -or $css -notmatch '\.simple-flow-arrow\.is-detail-reveal') {
    throw "Expected CSS hooks for detail-only simple flowchart steps and arrows."
}

if ($js -notmatch "IntersectionObserver") {
    throw "Expected script.js to handle reveal animations."
}

if ($js -notmatch 'let\s+currentLanguage\s*=\s*"en"') {
    throw "Expected script.js to track the current language for dynamic flowchart labels."
}

if ($js -notmatch 'syncSimpleFlowchart' -or $js -notmatch 'toggleSimpleFlowchart') {
    throw "Expected script.js to define simple flowchart sync and toggle helpers."
}

if ($js -notmatch 'buildSimpleFlowModel' -or $js -notmatch 'transitionSimpleFlowState') {
    throw "Expected script.js to use the simple flowchart state helpers."
}

if ($js -match 'mermaid\.run' -or $js -match 'flowchartRenderToken' -or $js -match 'main-flowchart') {
    throw "Expected script.js to remove Mermaid-specific firmware flow logic."
}

if ($js -notmatch 'data-flow-toggle-step' -or $js -notmatch 'simple-flow-track') {
    throw "Expected script.js to bind step-based flowchart expansion instead of a separate button."
}

if ($flowHtml -notmatch 'id="palette-groups"') {
    throw 'flow-builder/index.html is missing palette-groups'
}

if ($flowHtml -notmatch 'id="graph-output-list"') {
    throw 'flow-builder/index.html is missing graph-output-list'
}

if ($flowHtml -notmatch 'id="runtime-diagnostics"') {
    throw 'flow-builder/index.html is missing runtime-diagnostics'
}

Write-Host "Static site smoke test passed."
