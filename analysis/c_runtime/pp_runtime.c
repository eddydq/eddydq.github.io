#include <string.h>

#include "pp_runtime.h"

#define PP_MAX_NODE_PACKETS 16
#define PP_MAX_STATE_BYTES 256

typedef struct pp_node_result_s {
    char node_id[32];
    pp_port_packet_t packets[PP_MAX_NODE_PACKETS];
    size_t packet_count;
} pp_node_result_t;

static pp_node_result_t g_node_results[PP_MAX_GRAPH_NODES];
static unsigned char g_state_store[PP_MAX_GRAPH_NODES][PP_MAX_STATE_BYTES];
static char g_state_node_ids[PP_MAX_GRAPH_NODES][32];
static pp_port_packet_t g_bound_inputs[PP_MAX_NODE_PACKETS];
static pp_port_packet_t g_produced[PP_MAX_NODE_PACKETS];

static int refs_node(const char *ref, const char *node_id) {
    size_t len;

    if (!ref || !node_id || node_id[0] == '\0') {
        return 0;
    }

    len = strlen(node_id);
    return strncmp(ref, node_id, len) == 0 && ref[len] == '.' && ref[len + 1] != '\0';
}

static const char *ref_port(const char *ref) {
    const char *dot = strchr(ref, '.');
    return dot ? dot + 1 : "";
}

static const pp_runtime_input_packet_t *find_runtime_input(
    const pp_runtime_input_packet_t *input_packets,
    size_t input_count,
    const char *binding_name
) {
    for (size_t i = 0; i < input_count; i += 1) {
        if (input_packets[i].binding_name && strcmp(input_packets[i].binding_name, binding_name) == 0) {
            return &input_packets[i];
        }
    }
    return NULL;
}

static const pp_port_packet_t *find_node_output(
    const pp_node_result_t *node_results,
    size_t node_count,
    const char *node_id,
    const char *port_name
) {
    for (size_t i = 0; i < node_count; i += 1) {
        if (strcmp(node_results[i].node_id, node_id) != 0) {
            continue;
        }

        for (size_t p = 0; p < node_results[i].packet_count; p += 1) {
            if (node_results[i].packets[p].port_name &&
                strcmp(node_results[i].packets[p].port_name, port_name) == 0) {
                return &node_results[i].packets[p];
            }
        }
    }
    return NULL;
}

static const pp_node_t *find_node_by_id(const pp_graph_t *graph, const char *node_id) {
    for (size_t i = 0; i < graph->node_count; i += 1) {
        if (strcmp(graph->nodes[i].node_id, node_id) == 0) {
            return &graph->nodes[i];
        }
    }
    return NULL;
}

static const pp_input_port_def_t *find_input_port_def(const pp_block_manifest_t *manifest, const char *port_name) {
    if (!manifest || !port_name) {
        return NULL;
    }

    for (size_t i = 0; i < manifest->input_port_count; i += 1) {
        if (manifest->input_ports[i].name && strcmp(manifest->input_ports[i].name, port_name) == 0) {
            return &manifest->input_ports[i];
        }
    }
    return NULL;
}

static const pp_output_port_def_t *find_output_port_def(const pp_block_manifest_t *manifest, const char *port_name) {
    if (!manifest || !port_name) {
        return NULL;
    }

    for (size_t i = 0; i < manifest->output_port_count; i += 1) {
        if (manifest->output_ports[i].name && strcmp(manifest->output_ports[i].name, port_name) == 0) {
            return &manifest->output_ports[i];
        }
    }
    return NULL;
}

static int packet_kind_allowed(const pp_input_port_def_t *port_def, pp_packet_kind_t kind) {
    for (size_t i = 0; i < port_def->accepted_kind_count; i += 1) {
        if (port_def->accepted_kinds[i] == kind) {
            return 1;
        }
    }
    return 0;
}

static size_t count_bound_inputs_for_port(const char *port_name, size_t input_count) {
    size_t count = 0;

    for (size_t i = 0; i < input_count; i += 1) {
        if (g_bound_inputs[i].port_name && strcmp(g_bound_inputs[i].port_name, port_name) == 0) {
            count += 1;
        }
    }
    return count;
}

static void prepare_state_slot(size_t slot, const char *node_id, size_t state_size) {
    if (state_size == 0) {
        return;
    }

    if (strcmp(g_state_node_ids[slot], node_id) != 0) {
        memset(g_state_store[slot], 0, sizeof(g_state_store[slot]));
        memset(g_state_node_ids[slot], 0, sizeof(g_state_node_ids[slot]));
        strncpy(g_state_node_ids[slot], node_id, sizeof(g_state_node_ids[slot]) - 1);
    }
}

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

    status = pp_graph_build_schedule(graph, order, PP_MAX_GRAPH_NODES);
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
    if (graph->output_count > output_capacity) {
        return (pp_runtime_result_t){ PP_RUNTIME_INTERNAL_ERROR, "output buffer overflow" };
    }

    *output_count = 0;
    memset(g_node_results, 0, sizeof(g_node_results));

    for (size_t s = 0; s < graph->node_count; s += 1) {
        const pp_node_t *node = &graph->nodes[order[s]];
        const pp_block_descriptor_t *descriptor = pp_find_block_descriptor(node->block_id);
        size_t bound_input_count = 0;
        size_t produced_count = 0;

        memset(g_bound_inputs, 0, sizeof(g_bound_inputs));
        memset(g_produced, 0, sizeof(g_produced));

        if (!node->block_id || !descriptor) {
            return (pp_runtime_result_t){ PP_RUNTIME_UNKNOWN_BLOCK, "unknown block id" };
        }
        if (descriptor->state_size > PP_MAX_STATE_BYTES) {
            return (pp_runtime_result_t){ PP_RUNTIME_INTERNAL_ERROR, "block state buffer too small" };
        }
        prepare_state_slot(order[s], node->node_id, descriptor->state_size);

        for (size_t e = 0; e < graph->connection_count; e += 1) {
            const pp_input_port_def_t *input_def;
            const char *target_port;

            if (!refs_node(graph->connections[e].target_ref, node->node_id)) {
                continue;
            }
            if (bound_input_count >= PP_MAX_NODE_PACKETS) {
                return (pp_runtime_result_t){ PP_RUNTIME_INTERNAL_ERROR, "too many bound input packets" };
            }

            target_port = ref_port(graph->connections[e].target_ref);
            input_def = find_input_port_def(&descriptor->manifest, target_port);
            if (!input_def) {
                return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown input port" };
            }
            if (strncmp(graph->connections[e].source_ref, "input.", 6) == 0) {
                const pp_runtime_input_packet_t *runtime_input = find_runtime_input(
                    input_packets,
                    input_count,
                    graph->connections[e].source_ref + 6
                );

                if (!runtime_input) {
                    return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "missing graph input packet" };
                }
                if (!packet_kind_allowed(input_def, runtime_input->packet.kind)) {
                    return (pp_runtime_result_t){ PP_RUNTIME_PACKET_MISMATCH, "packet kind mismatch" };
                }

                g_bound_inputs[bound_input_count].port_name = target_port;
                g_bound_inputs[bound_input_count].packet = runtime_input->packet;
                bound_input_count += 1;
                continue;
            }

            {
                const char *dot = strchr(graph->connections[e].source_ref, '.');
                char source_node_id[32] = {0};
                const pp_port_packet_t *source_packet;
                const pp_node_t *source_node;
                const pp_block_descriptor_t *source_descriptor;

                if (!dot || (size_t)(dot - graph->connections[e].source_ref) >= sizeof(source_node_id)) {
                    return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "invalid source ref" };
                }

                memcpy(source_node_id, graph->connections[e].source_ref, (size_t)(dot - graph->connections[e].source_ref));
                source_node = find_node_by_id(graph, source_node_id);
                if (!source_node) {
                    return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown source node" };
                }
                source_descriptor = pp_find_block_descriptor(source_node->block_id);
                if (!source_descriptor) {
                    return (pp_runtime_result_t){ PP_RUNTIME_UNKNOWN_BLOCK, "unknown block id" };
                }
                if (!find_output_port_def(&source_descriptor->manifest, dot + 1)) {
                    return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown output port" };
                }
                source_packet = find_node_output(g_node_results, graph->node_count, source_node_id, dot + 1);
                if (!source_packet) {
                    return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "missing upstream packet" };
                }
                if (!packet_kind_allowed(input_def, source_packet->packet.kind)) {
                    return (pp_runtime_result_t){ PP_RUNTIME_PACKET_MISMATCH, "packet kind mismatch" };
                }

                g_bound_inputs[bound_input_count].port_name = target_port;
                g_bound_inputs[bound_input_count].packet = source_packet->packet;
                bound_input_count += 1;
            }
        }

        for (size_t i = 0; i < descriptor->manifest.input_port_count; i += 1) {
            const pp_input_port_def_t *input_def = &descriptor->manifest.input_ports[i];
            size_t input_port_count = count_bound_inputs_for_port(input_def->name, bound_input_count);

            if (input_def->cardinality == PP_PORT_ONE && input_port_count != 1) {
                return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "single-cardinality input not satisfied" };
            }
        }

        status = descriptor->run(
            g_bound_inputs,
            bound_input_count,
            node->params_json ? node->params_json : "{}",
            descriptor->state_size > 0 ? g_state_store[order[s]] : NULL,
            g_produced,
            &produced_count
        );
        if (status.status != PP_RUNTIME_OK) {
            return status;
        }
        if (produced_count > PP_MAX_NODE_PACKETS) {
            return (pp_runtime_result_t){ PP_RUNTIME_INTERNAL_ERROR, "too many produced packets" };
        }
        for (size_t i = 0; i < produced_count; i += 1) {
            const pp_output_port_def_t *output_def = find_output_port_def(&descriptor->manifest, g_produced[i].port_name);

            if (!output_def) {
                return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown output port" };
            }
            if (output_def->emitted_kind != g_produced[i].packet.kind) {
                return (pp_runtime_result_t){ PP_RUNTIME_PACKET_MISMATCH, "output packet kind mismatch" };
            }
        }

        memset(g_node_results[order[s]].node_id, 0, sizeof(g_node_results[order[s]].node_id));
        strncpy(g_node_results[order[s]].node_id, node->node_id, sizeof(g_node_results[order[s]].node_id) - 1);
        memcpy(g_node_results[order[s]].packets, g_produced, sizeof(pp_port_packet_t) * produced_count);
        g_node_results[order[s]].packet_count = produced_count;
    }

    for (size_t i = 0; i < graph->output_count; i += 1) {
        const char *dot = strchr(graph->outputs[i].source_ref, '.');
        char source_node_id[32] = {0};
        const pp_port_packet_t *source_packet;
        const pp_node_t *source_node;
        const pp_block_descriptor_t *source_descriptor;

        if (!dot || (size_t)(dot - graph->outputs[i].source_ref) >= sizeof(source_node_id)) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "invalid output source ref" };
        }

        memcpy(source_node_id, graph->outputs[i].source_ref, (size_t)(dot - graph->outputs[i].source_ref));
        source_node = find_node_by_id(graph, source_node_id);
        if (!source_node) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown output source node" };
        }
        source_descriptor = pp_find_block_descriptor(source_node->block_id);
        if (!source_descriptor) {
            return (pp_runtime_result_t){ PP_RUNTIME_UNKNOWN_BLOCK, "unknown block id" };
        }
        if (!find_output_port_def(&source_descriptor->manifest, dot + 1)) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown output port" };
        }
        source_packet = find_node_output(g_node_results, graph->node_count, source_node_id, dot + 1);
        if (!source_packet) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "missing output packet" };
        }

        output_packets[*output_count].binding_name = graph->outputs[i].name;
        output_packets[*output_count].packet = source_packet->packet;
        *output_count += 1;
    }

    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
