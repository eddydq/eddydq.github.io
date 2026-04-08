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

if ($html -notmatch 'class="flowchart-shell" id="flowchart-shell"') {
    throw "Expected firmware flow shell class hook in index.html."
}

if ($html -notmatch 'id="flowchart-back-btn"') {
    throw "Expected firmware flow back button in index.html."
}

if ($html -notmatch 'class="flowchart-toolbar"' -or $html -notmatch 'class="flowchart-back-btn"' -or $html -notmatch 'class="flowchart-frame"' -or $html -notmatch 'class="mermaid flowchart-stage"') {
    throw "Expected Task 4 firmware flow structural class hooks in index.html."
}

if ($css -notmatch "--navy") {
    throw "Expected a color system in styles.css."
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

Write-Host "Static site smoke test passed."
