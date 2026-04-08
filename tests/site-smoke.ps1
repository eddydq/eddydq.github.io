$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$requiredFiles = @(
    "index.html",
    "styles.css",
    "script.js",
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

if ($html -notmatch "Paddling Pulse") {
    throw "Expected the site title to mention Paddling Pulse."
}

if ($html -notmatch "styles\.css" -or $html -notmatch "script\.js") {
    throw "Expected index.html to reference styles.css and script.js."
}

if ($html -notmatch "data-reveal") {
    throw "Expected reveal hooks in the markup."
}

if ($html -notmatch 'id="flowchart-shell"') {
    throw "Expected firmware flow shell container in index.html."
}

if ($html -notmatch 'class="[^"]*\bflowchart-shell\b[^"]*"') {
    throw "Expected firmware flow shell class hook in index.html."
}

if ($html -notmatch 'id="flowchart-back-btn"') {
    throw "Expected firmware flow back button in index.html."
}

if ($html -notmatch 'class="[^"]*\bflowchart-toolbar\b[^"]*"' -or $html -notmatch 'class="[^"]*\bflowchart-back-btn\b[^"]*"' -or $html -notmatch 'class="[^"]*\bflowchart-frame\b[^"]*"' -or $html -notmatch 'class="[^"]*\bflowchart-stage\b[^"]*"') {
    throw "Expected Task 4 firmware flow structural class hooks in index.html."
}

if ($html -match '<div class="flowchart-shell"[^>]*style=' -or $html -match '<div class="flowchart-frame"[^>]*style=') {
    throw "Expected firmware flow shell and frame layout to move out of inline HTML styles."
}

if ($css -notmatch "--navy") {
    throw "Expected a color system in styles.css."
}

if ($css -notmatch '\.flowchart-shell' -or $css -notmatch '\.flowchart-frame') {
    throw "Expected firmware flow shell/frame styles in styles.css."
}

if ($css -notmatch '\.flowchart-shell\.is-detail') {
    throw "Expected detail-state flowchart shell styling in styles.css."
}

if ($css -match '\.flowchart-frame\s*\{[^}]*overflow:\s*hidden') {
    throw "Expected firmware flow frame to avoid clipping overflow on narrow screens."
}

if ($css -notmatch '\.flowchart-frame\s*\{[^}]*overflow:\s*(auto|scroll)' -and $css -notmatch '\.flowchart-stage\s*\{[^}]*overflow:\s*(auto|scroll)') {
    throw "Expected the firmware flow to provide contained scrolling instead of clipping."
}

if ($css -notmatch '\.flowchart-stage\s*\{[^}]*transition:\s*[^}]*(opacity|transform)') {
    throw "Expected transition styling on the firmware flow stage rules."
}

if ($css -notmatch '\.flowchart-shell\.is-transitioning\s+\.flowchart-stage') {
    throw "Expected transitioning flowchart stage styling in styles.css."
}

if ($js -notmatch "IntersectionObserver") {
    throw "Expected script.js to handle reveal animations."
}

if ($js -notmatch "createFlowchartState" -or $js -notmatch "transitionFlowchartState") {
    throw "Expected script.js to use the firmware flow state helpers."
}

if ($js -match "expandedFlow") {
    throw "Expected script.js to remove the legacy expandedFlow page state."
}

if ($js -notmatch "classList\.toggle\('is-detail'") {
    throw "Expected script.js to toggle the flowchart is-detail class."
}

if ($js -notmatch 'async function rerenderFlowchart') {
    throw "Expected script.js to define a rerenderFlowchart helper."
}

if ($js -notmatch "classList\.add\('is-transitioning'") {
    throw "Expected script.js to add the flowchart transitioning class during rerenders."
}

if ($js -notmatch "classList\.remove\('is-transitioning'") {
    throw "Expected script.js to remove the flowchart transitioning class after rerenders."
}

if ($js -notmatch 'let\s+flowchartRenderToken\s*=\s*0') {
    throw "Expected script.js to track flowchart rerender tokens for overlapping updates."
}

if ($js -notmatch 'const\s+renderToken\s*=\s*\+\+flowchartRenderToken') {
    throw "Expected script.js to increment a flowchart rerender token per rerender."
}

if ($js -notmatch 'if\s*\(\s*renderToken\s*!==\s*flowchartRenderToken\s*\)\s*\{\s*return;\s*\}') {
    throw "Expected script.js to ignore stale overlapping flowchart rerenders."
}

Write-Host "Static site smoke test passed."
