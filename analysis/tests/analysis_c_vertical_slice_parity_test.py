from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from analysis.scripts.blocks import Packet, PipelineExecutor
from analysis.algorithms.representation.py.select_axis import BLOCK as SELECT_AXIS
from analysis.algorithms.estimation.py.autocorrelation import BLOCK as AUTOCORR
from analysis.algorithms.validation.py.spm_range_gate import BLOCK as RANGE_GATE
from analysis.algorithms.suivi.py.kalman_2d import BLOCK as KALMAN


SHELL = shutil.which("powershell") or shutil.which("pwsh")
NODE = shutil.which("node")


@pytest.mark.skipif(shutil.which("emcc") is None, reason="emcc not on PATH")
@pytest.mark.skipif(SHELL is None, reason="no PowerShell host on PATH")
@pytest.mark.skipif(NODE is None, reason="node not on PATH")
def test_vertical_slice_matches_python_reference():
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

    browser_graph = {
        "schema_version": 2,
        "nodes": [
            {"node_id": "n1", "block_id": "representation.select_axis", "params": {"axis": "y"}},
            {"node_id": "n2", "block_id": "estimation.autocorrelation", "params": {"min_lag_samples": 10, "max_lag_samples": 80}},
            {"node_id": "n3", "block_id": "validation.spm_range_gate", "params": {"min_spm": 20.0, "max_spm": 120.0}},
            {"node_id": "n4", "block_id": "suivi.kalman_2d", "params": {"process_noise": 1.0, "measurement_noise": 10.0}},
        ],
        "connections": [
            {"source": "input.raw", "target": "n1.source"},
            {"source": "n1.primary", "target": "n2.source"},
            {"source": "n2.primary", "target": "n3.source"},
            {"source": "n3.accepted", "target": "n4.source"},
        ],
        "outputs": {"final": "n4.primary"},
    }
    python_graph = {
        "nodes": browser_graph["nodes"],
        "inputs": {edge["target"]: edge["source"] for edge in browser_graph["connections"]},
        "outputs": browser_graph["outputs"],
    }
    packet = Packet(
        kind="raw_window",
        sample_rate_hz=52.0,
        data={
            "series": {
                "x": [0.0] * 64,
                "y": [1.0 if (i % 26) < 13 else -1.0 for i in range(64)],
                "z": [0.0] * 64,
            }
        },
    )
    expected, _ = PipelineExecutor({
        "representation.select_axis": SELECT_AXIS,
        "estimation.autocorrelation": AUTOCORR,
        "validation.spm_range_gate": RANGE_GATE,
        "suivi.kalman_2d": KALMAN,
    }).run(python_graph, {"input.raw": [packet]})

    run = subprocess.run(
        [NODE, "analysis/wasm/runtime-smoke.mjs", "vertical-slice"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    actual = json.loads(run.stdout)
    assert round(actual["outputs"]["final"][0]["data"]["spm"], 3) == round(expected["final"][0].data["spm"], 3)
