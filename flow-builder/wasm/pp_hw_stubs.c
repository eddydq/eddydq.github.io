#include "pp_block.h"

static pp_block_result_t pp_wasm_source_skip(pp_packet_t *outputs, uint8_t num_outputs)
{
    pp_block_result_t result = { .status = PP_SKIP };

    if (outputs && num_outputs > 0U) {
        outputs[0].length = 0;
        outputs[0].kind = PP_KIND_RAW_WINDOW;
        outputs[0].axis = PP_AXIS_ALL;
        outputs[0].sample_rate_hz = 0;
    }

    return result;
}

pp_block_result_t pp_lis3dh_source_exec(
    const pp_packet_t *inputs,
    uint8_t num_inputs,
    const uint8_t *params,
    uint16_t params_len,
    uint8_t *state,
    pp_packet_t *outputs,
    uint8_t num_outputs)
{
    (void)inputs;
    (void)num_inputs;
    (void)params;
    (void)params_len;
    (void)state;
    return pp_wasm_source_skip(outputs, num_outputs);
}

pp_block_result_t pp_mpu6050_source_exec(
    const pp_packet_t *inputs,
    uint8_t num_inputs,
    const uint8_t *params,
    uint16_t params_len,
    uint8_t *state,
    pp_packet_t *outputs,
    uint8_t num_outputs)
{
    (void)inputs;
    (void)num_inputs;
    (void)params;
    (void)params_len;
    (void)state;
    return pp_wasm_source_skip(outputs, num_outputs);
}

pp_block_result_t pp_polar_source_exec(
    const pp_packet_t *inputs,
    uint8_t num_inputs,
    const uint8_t *params,
    uint16_t params_len,
    uint8_t *state,
    pp_packet_t *outputs,
    uint8_t num_outputs)
{
    (void)inputs;
    (void)num_inputs;
    (void)params;
    (void)params_len;
    (void)state;
    return pp_wasm_source_skip(outputs, num_outputs);
}
