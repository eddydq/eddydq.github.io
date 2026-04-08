#include "pp_runtime.h"

pp_runtime_result_t pp_runtime_run(
    const pp_graph_t *graph,
    const pp_runtime_input_packet_t *input_packets,
    size_t input_count,
    pp_runtime_output_packet_t *output_packets,
    size_t output_capacity,
    size_t *output_count
) {
    size_t order[PP_MAX_GRAPH_NODES] = {0};
    int has_named_input = 0;
    pp_runtime_result_t status = pp_graph_validate(graph);

    if (status.status != PP_RUNTIME_OK) {
        return status;
    }

    status = pp_graph_build_schedule(graph, order, 64);
    if (status.status != PP_RUNTIME_OK) {
        return status;
    }

    if (input_count == 0 || input_packets == NULL || output_packets == NULL || output_count == NULL || output_capacity == 0) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "no input packets supplied" };
    }

    for (size_t i = 0; i < input_count; i += 1) {
        if (input_packets[i].binding_name != NULL && input_packets[i].binding_name[0] != '\0') {
            has_named_input = 1;
            break;
        }
    }

    if (!has_named_input) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "no named input packets supplied" };
    }

    (void)order;
    *output_count = 0;
    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
