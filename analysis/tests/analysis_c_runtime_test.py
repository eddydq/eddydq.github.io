from __future__ import annotations

import shutil
import subprocess

import pytest


SHELL = shutil.which("powershell") or shutil.which("pwsh")
NODE = shutil.which("node")


@pytest.mark.skipif(shutil.which("emcc") is None, reason="emcc not on PATH")
@pytest.mark.skipif(SHELL is None, reason="no PowerShell host on PATH")
@pytest.mark.skipif(NODE is None, reason="node not on PATH")
def test_runtime_smoke_harness_reports_validation_and_state():
    build = subprocess.run(
        [
            SHELL,
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "analysis/wasm/build-runtime.ps1",
            "-Target",
            "runtime-node",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stdout + build.stderr

    run = subprocess.run(
        [NODE, "analysis/wasm/runtime-smoke.mjs"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert '"validate_ok":true' in run.stdout
    assert '"cycle_detected":true' in run.stdout
    assert '"state_ok":true' in run.stdout
