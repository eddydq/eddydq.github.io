#include <stdio.h>
#include <string.h>

#include "../../c_api/pp_runtime.h"

typedef struct pp_kalman_state_s {
    float x0;
    float x1;
    float p00;
    float p01;
    float p10;
    float p11;
} pp_kalman_state_t;

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

static pp_runtime_result_t run_kalman_2d(
    const pp_port_packet_t *inputs,
    size_t input_count,
    const char *params_json,
    void *state_buffer,
    pp_port_packet_t *outputs,
    size_t *output_count
) {
    const float process_noise = parse_float_param(params_json, "process_noise", 1.0f);
    const float measurement_noise = parse_float_param(params_json, "measurement_noise", 10.0f);
    const pp_candidate_t *candidate;
    float measurement;
    pp_kalman_state_t *state = (pp_kalman_state_t *)state_buffer;
    float x0_pred;
    float x1_pred;
    float p00_pred;
    float p01_pred;
    float p10_pred;
    float p11_pred;
    float innovation;
    float innovation_covariance;
    float gain0;
    float gain1;

    if (!inputs || input_count == 0 || !outputs || !output_count || !state) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "kalman_2d missing packets" };
    }

    candidate = &inputs[0].packet.payload.candidate;
    measurement = candidate->spm;

    if (state->p00 == 0.0f && state->p11 == 0.0f) {
        state->x0 = measurement;
        state->x1 = 0.0f;
        state->p00 = 1000.0f;
        state->p01 = 0.0f;
        state->p10 = 0.0f;
        state->p11 = 1000.0f;
    }

    x0_pred = state->x0 + state->x1;
    x1_pred = state->x1;
    p00_pred = state->p00 + state->p01 + state->p10 + state->p11 + process_noise;
    p01_pred = state->p01 + state->p11;
    p10_pred = state->p10 + state->p11;
    p11_pred = state->p11 + process_noise;

    innovation = measurement - x0_pred;
    innovation_covariance = p00_pred + measurement_noise;
    gain0 = p00_pred / innovation_covariance;
    gain1 = p10_pred / innovation_covariance;

    state->x0 = x0_pred + gain0 * innovation;
    state->x1 = x1_pred + gain1 * innovation;
    state->p00 = p00_pred - gain0 * p00_pred;
    state->p01 = p01_pred - gain0 * p01_pred;
    state->p10 = p10_pred - gain1 * p00_pred;
    state->p11 = p11_pred - gain1 * p01_pred;

    outputs[0].port_name = "primary";
    outputs[0].packet.kind = PP_PACKET_ESTIMATE;
    outputs[0].packet.payload.estimate.sample_rate_hz = inputs[0].packet.payload.candidate.sample_rate_hz;
    outputs[0].packet.payload.estimate.spm = state->x0;
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}

static const pp_packet_kind_t KALMAN_INPUT_KINDS[] = { PP_PACKET_CANDIDATE };
static const pp_input_port_def_t KALMAN_INPUTS[] = {
    { "source", KALMAN_INPUT_KINDS, 1, PP_PORT_ONE }
};
static const pp_output_port_def_t KALMAN_OUTPUTS[] = {
    { "primary", PP_PACKET_ESTIMATE }
};
static const pp_param_schema_t KALMAN_PARAMS[] = {
    { "process_noise", PP_PARAM_FLOAT, "1.0", 0.001, 1000.0, NULL },
    { "measurement_noise", PP_PARAM_FLOAT, "10.0", 0.001, 1000.0, NULL }
};

const pp_block_descriptor_t PP_BLOCK_KALMAN_2D = {
    .manifest = {
        .block_id = "suivi.kalman_2d",
        .group_name = "suivi",
        .input_ports = KALMAN_INPUTS,
        .input_port_count = 1,
        .output_ports = KALMAN_OUTPUTS,
        .output_port_count = 1,
        .params = KALMAN_PARAMS,
        .param_count = 2,
        .stateful = 1
    },
    .state_size = sizeof(pp_kalman_state_t),
    .run = run_kalman_2d
};
