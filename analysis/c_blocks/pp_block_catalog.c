#include <string.h>

#include "../c_api/pp_runtime.h"

extern const pp_block_descriptor_t PP_BLOCK_SELECT_AXIS;
extern const pp_block_descriptor_t PP_BLOCK_AUTOCORRELATION;
extern const pp_block_descriptor_t PP_BLOCK_SPM_RANGE_GATE;
extern const pp_block_descriptor_t PP_BLOCK_KALMAN_2D;

static const pp_block_descriptor_t *PP_BLOCKS[] = {
    &PP_BLOCK_SELECT_AXIS,
    &PP_BLOCK_AUTOCORRELATION,
    &PP_BLOCK_SPM_RANGE_GATE,
    &PP_BLOCK_KALMAN_2D
};

const pp_block_descriptor_t *pp_find_block_descriptor(const char *block_id) {
    if (!block_id) {
        return NULL;
    }

    for (size_t i = 0; i < sizeof(PP_BLOCKS) / sizeof(PP_BLOCKS[0]); i += 1) {
        if (strcmp(PP_BLOCKS[i]->manifest.block_id, block_id) == 0) {
            return PP_BLOCKS[i];
        }
    }
    return NULL;
}
