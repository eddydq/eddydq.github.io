#include <string.h>

#include "../../c_api/pp_runtime.h"

static const char *parse_axis(const char *params_json) {
    if (params_json && strstr(params_json, "\"axis\":\"x\"")) {
        return "x";
    }
    if (params_json && strstr(params_json, "\"axis\":\"z\"")) {
        return "z";
    }
    return "y";
}

static pp_runtime_result_t run_select_axis(
    const pp_port_packet_t *inputs,
    size_t input_count,
    const char *params_json,
    void *state_buffer,
    pp_port_packet_t *outputs,
    size_t *output_count
) {
    const char *axis = parse_axis(params_json);
    const pp_raw_window_t *source;
    const float *axis_values;
    pp_series_t *series;

    (void)state_buffer;

    if (!inputs || input_count == 0 || !outputs || !output_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "select_axis missing packets" };
    }

    source = &inputs[0].packet.payload.raw_window;
    if (source->length > PP_MAX_SERIES_SAMPLES) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "select_axis length exceeds buffer" };
    }
    axis_values = source->y;
    if (strcmp(axis, "x") == 0) {
        axis_values = source->x;
    } else if (strcmp(axis, "z") == 0) {
        axis_values = source->z;
    }

    outputs[0].port_name = "primary";
    outputs[0].packet.kind = PP_PACKET_SERIES;
    series = &outputs[0].packet.payload.series;
    series->sample_rate_hz = source->sample_rate_hz;
    series->length = source->length;
    memset(series->axis, 0, sizeof(series->axis));
    strncpy(series->axis, axis, sizeof(series->axis) - 1);
    memcpy(series->values, axis_values, sizeof(float) * source->length);
    *output_count = 1;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}

static const pp_packet_kind_t SELECT_AXIS_INPUT_KINDS[] = { PP_PACKET_RAW_WINDOW };
static const pp_input_port_def_t SELECT_AXIS_INPUTS[] = {
    { "source", SELECT_AXIS_INPUT_KINDS, 1, PP_PORT_ONE }
};
static const pp_output_port_def_t SELECT_AXIS_OUTPUTS[] = {
    { "primary", PP_PACKET_SERIES }
};
static const pp_param_schema_t SELECT_AXIS_PARAMS[] = {
    { "axis", PP_PARAM_ENUM, "\"y\"", 0.0, 0.0, "x,y,z" }
};

const pp_block_descriptor_t PP_BLOCK_SELECT_AXIS = {
    .manifest = {
        .block_id = "representation.select_axis",
        .group_name = "representation",
        .input_ports = SELECT_AXIS_INPUTS,
        .input_port_count = 1,
        .output_ports = SELECT_AXIS_OUTPUTS,
        .output_port_count = 1,
        .params = SELECT_AXIS_PARAMS,
        .param_count = 1,
        .stateful = 0
    },
    .state_size = 0,
    .run = run_select_axis
};
