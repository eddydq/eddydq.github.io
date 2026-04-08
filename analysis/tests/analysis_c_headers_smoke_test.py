from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def test_header_smoke_build():
    result = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "header-smoke",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if shutil.which("emcc") is None:
        assert result.returncode == 1
        assert "emcc not found on PATH" in (result.stdout + result.stderr)
        return

    assert result.returncode == 0, result.stdout + result.stderr
    assert Path("analysis/wasm/header-smoke.mjs").exists()
