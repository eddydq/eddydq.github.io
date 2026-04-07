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

if ($css -notmatch "--navy") {
    throw "Expected a color system in styles.css."
}

if ($js -notmatch "IntersectionObserver") {
    throw "Expected script.js to handle reveal animations."
}

Write-Host "Static site smoke test passed."
