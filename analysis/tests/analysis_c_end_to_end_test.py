from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("emcc") is None, reason="emcc not on PATH")
def test_browser_artifacts_and_catalog_are_emitted() -> None:
    build = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "end-to-end",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stdout + build.stderr
    assert Path("assets/flow-runtime.js").exists()
    assert Path("assets/flow-runtime.wasm").exists()
    assert Path("assets/flow-block-catalog.json").exists()
