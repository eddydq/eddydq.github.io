#include <stdio.h>
#include <string.h>

#include "../../c_api/pp_runtime.h"

static int parse_int_param(const char *params_json, const char *key, int fallback) {
    char pattern[64] = {0};
    float value = (float)fallback;

    if (!params_json || !key) {
        return fallback;
    }

    snprintf(pattern, sizeof(pattern), "\"%s\":%%f", key);
    if (sscanf(strstr(params_json, key) ? strstr(params_json, key) - 1 : "", pattern, &value) == 1) {
        return (int)value;
    }
    return fallback;
}

static pp_runtime_result_t run_autocorrelation(
    const pp_port_packet_t *inputs,
    size_t input_count,
    const char *params_json,
    void *state_buffer,
    pp_port_packet_t *outputs,
    size_t *output_count
) {
    const pp_series_t *series;
    float centered[PP_MAX_SERIES_SAMPLES] = {0};
    float mean = 0.0f;
    int min_lag;
    int max_lag;
    float best_value = -1.0f;
    int best_lag;

    (void)state_buffer;

    if (!inputs || input_count == 0 || !outputs || !output_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "autocorrelation missing packets" };
    }

    series = &inputs[0].packet.payload.series;
    if (series->length > PP_MAX_SERIES_SAMPLES) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "autocorrelation length exceeds buffer" };
    }
    min_lag = parse_int_param(params_json, "min_lag_samples", 15);
    max_lag = parse_int_param(params_json, "max_lag_samples", 160);

    if (series->length == 0) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "autocorrelation empty series" };
    }
    if (min_lag < 1) {
        min_lag = 1;
    }
    if (max_lag >= (int)series->length) {
        max_lag = (int)series->length - 1;
    }
    if (max_lag < min_lag) {
        outputs[0].port_name = "primary";
        outputs[0].packet.kind = PP_PACKET_CANDIDATE;
        outputs[0].packet.payload.candidate.sample_rate_hz = series->sample_rate_hz;
        outputs[0].packet.payload.candidate.spm = 0.0f;
        outputs[0].packet.payload.candidate.confidence = 0.0f;
        *output_count = 1;
        return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
    }

    for (uint16_t i = 0; i < series->length; i += 1) {
        mean += series->values[i];
    }
    mean /= (float)series->length;

    for (uint16_t i = 0; i < series->length; i += 1) {
        centered[i] = series->values[i] - mean;
    }

    best_lag = min_lag;
    for (int lag = min_lag; lag <= max_lag; lag += 1) {
        float score = 0.0f;
        for (uint16_t i = 0; i + lag < series->length; i += 1) {
            score += centered[i] * centered[i + lag];
        }
        if (score > best_value) {
            best_value = score;
            best_lag = lag;
        }
    }

    outputs[0].port_name = "primary";
    outputs[0].packet.kind = PP_PACKET_CANDIDATE;
    outputs[0].packet.payload.candidate.sample_rate_hz = series->sample_rate_hz;
    outputs[0].packet.payload.candidate.spm = (60.0f * series->sample_rate_hz) / (float)best_lag;
    outputs[0].packet.payload.candidate.confidence = 1.0f;
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}

static const pp_packet_kind_t AUTOCORR_INPUT_KINDS[] = { PP_PACKET_SERIES };
static const pp_input_port_def_t AUTOCORR_INPUTS[] = {
    { "source", AUTOCORR_INPUT_KINDS, 1, PP_PORT_ONE }
};
static const pp_output_port_def_t AUTOCORR_OUTPUTS[] = {
    { "primary", PP_PACKET_CANDIDATE }
};
static const pp_param_schema_t AUTOCORR_PARAMS[] = {
    { "min_lag_samples", PP_PARAM_INT, "15", 1.0, 512.0, NULL },
    { "max_lag_samples", PP_PARAM_INT, "160", 2.0, 512.0, NULL }
};

const pp_block_descriptor_t PP_BLOCK_AUTOCORRELATION = {
    .manifest = {
        .block_id = "estimation.autocorrelation",
        .group_name = "estimation",
        .input_ports = AUTOCORR_INPUTS,
        .input_port_count = 1,
        .output_ports = AUTOCORR_OUTPUTS,
        .output_port_count = 1,
        .params = AUTOCORR_PARAMS,
        .param_count = 2,
        .stateful = 0
    },
    .state_size = 0,
    .run = run_autocorrelation
};
