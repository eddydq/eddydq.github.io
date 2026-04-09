#include <stdio.h>
#include <string.h>

#include "../../c_api/pp_runtime.h"

static float parse_float_param(const char *params_json, const char *key, float fallback) {
    char pattern[64] = {0};
    float value = fallback;

    if (!params_json || !key) {
        return fallback;
    }

    snprintf(pattern, sizeof(pattern), "\"%s\":%%f", key);
    if (sscanf(strstr(params_json, key) ? strstr(params_json, key) - 1 : "", pattern, &value) == 1) {
        return value;
    }
    return fallback;
}

static pp_runtime_result_t run_spm_range_gate(
    const pp_port_packet_t *inputs,
    size_t input_count,
    const char *params_json,
    void *state_buffer,
    pp_port_packet_t *outputs,
    size_t *output_count
) {
    float min_spm;
    float max_spm;
    float spm;

    (void)state_buffer;

    if (!inputs || input_count == 0 || !outputs || !output_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "spm_range_gate missing packets" };
    }

    min_spm = parse_float_param(params_json, "min_spm", 20.0f);
    max_spm = parse_float_param(params_json, "max_spm", 120.0f);
    spm = inputs[0].packet.payload.candidate.spm;

    outputs[0].packet = inputs[0].packet;
    outputs[0].port_name = (spm >= min_spm && spm <= max_spm) ? "accepted" : "rejected";
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}

static const pp_packet_kind_t RANGE_GATE_INPUT_KINDS[] = { PP_PACKET_CANDIDATE };
static const pp_input_port_def_t RANGE_GATE_INPUTS[] = {
    { "source", RANGE_GATE_INPUT_KINDS, 1, PP_PORT_ONE }
};
static const pp_output_port_def_t RANGE_GATE_OUTPUTS[] = {
    { "accepted", PP_PACKET_CANDIDATE },
    { "rejected", PP_PACKET_CANDIDATE }
};
static const pp_param_schema_t RANGE_GATE_PARAMS[] = {
    { "min_spm", PP_PARAM_FLOAT, "20.0", 0.0, 1000.0, NULL },
    { "max_spm", PP_PARAM_FLOAT, "120.0", 0.0, 1000.0, NULL }
};

const pp_block_descriptor_t PP_BLOCK_SPM_RANGE_GATE = {
    .manifest = {
        .block_id = "validation.spm_range_gate",
        .group_name = "validation",
        .input_ports = RANGE_GATE_INPUTS,
        .input_port_count = 1,
        .output_ports = RANGE_GATE_OUTPUTS,
        .output_port_count = 2,
        .params = RANGE_GATE_PARAMS,
        .param_count = 2,
        .stateful = 0
    },
    .state_size = 0,
    .run = run_spm_range_gate
};
