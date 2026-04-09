from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
GCC = shutil.which("gcc")


@pytest.mark.skipif(GCC is None, reason="gcc not on PATH")
def test_wasm_bridge_accepts_emitted_packet_envelope(tmp_path: Path) -> None:
    source = tmp_path / "pp_wasm_bridge_smoke.c"
    exe = tmp_path / "pp_wasm_bridge_smoke.exe"
    source.write_text(
        r'''
#include <stdio.h>

const char *pp_wasm_catalog_json(void);
int pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json);
const char *pp_wasm_last_result_json(void);

int main(void) {
    const char *graph_json =
        "{\"schema_version\":2,"
        "\"nodes\":[{\"node_id\":\"n1\",\"block_id\":\"suivi.kalman_2d\",\"params\":{}}],"
        "\"connections\":[{\"source\":\"input.candidate\",\"target\":\"n1.source\"}],"
        "\"outputs\":{\"final\":\"n1.primary\"}}";
    const char *inputs_json =
        "[{\"binding_name\":\"candidate\",\"packet\":"
        "{\"kind\":\"candidate\",\"data\":{\"sample_rate_hz\":52,\"spm\":120,\"confidence\":1}}}]";

    puts(pp_wasm_catalog_json());
    printf("%d\n", pp_wasm_run_graph_json(graph_json, inputs_json));
    puts(pp_wasm_last_result_json());
    return 0;
}
''',
        encoding="utf-8",
    )

    build = subprocess.run(
        [
            GCC,
            "-std=c99",
            "-Wall",
            "-Wextra",
            "-pedantic",
            "-Ianalysis/c_api",
            "analysis/c_runtime/pp_graph_validate.c",
            "analysis/c_runtime/pp_graph_schedule.c",
            "analysis/c_runtime/pp_runtime.c",
            "analysis/c_blocks/pp_block_catalog.c",
            "analysis/c_blocks/representation/pp_block_select_axis.c",
            "analysis/c_blocks/estimation/pp_block_autocorrelation.c",
            "analysis/c_blocks/validation/pp_block_spm_range_gate.c",
            "analysis/c_blocks/suivi/pp_block_kalman_2d.c",
            "analysis/wasm/pp_wasm_exports.c",
            str(source),
            "-o",
            str(exe),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, build.stdout + build.stderr

    run = subprocess.run(
        [str(exe)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr

    lines = [line for line in run.stdout.splitlines() if line.strip()]
    assert len(lines) >= 3

    catalog = json.loads(lines[0])
    assert catalog["blocks"]
    assert lines[1] == "0", run.stdout

    result = json.loads(lines[2])
    assert result["outputs"]["final"][0]["kind"] == "estimate"
