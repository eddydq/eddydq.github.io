#include <string.h>

#include "../c_api/pp_runtime.h"

static int refs_node(const char *ref, const char *node_id) {
    if (!ref || !node_id || node_id[0] == '\0') {
        return 0;
    }

    size_t len = strlen(node_id);
    return strncmp(ref, node_id, len) == 0 && ref[len] == '.' && ref[len + 1] != '\0';
}

pp_runtime_result_t pp_graph_validate(const pp_graph_t *graph) {
    if (!graph || graph->schema_version != 2) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unsupported schema version" };
    }

    if ((graph->node_count > 0 && graph->nodes == NULL) ||
        (graph->connection_count > 0 && graph->connections == NULL) ||
        (graph->output_count > 0 && graph->outputs == NULL)) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "graph arrays are missing for non-zero counts" };
    }

    for (size_t n = 0; n < graph->node_count; n += 1) {
        if (!graph->nodes[n].node_id || graph->nodes[n].node_id[0] == '\0') {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "node is missing node_id" };
        }

        for (size_t other = n + 1; other < graph->node_count; other += 1) {
            if (strcmp(graph->nodes[n].node_id, graph->nodes[other].node_id) == 0) {
                return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "duplicate node id" };
            }
        }
    }

    for (size_t i = 0; i < graph->connection_count; i += 1) {
        const pp_connection_t *edge = &graph->connections[i];
        int source_found = 0;
        int target_found = 0;

        if (!edge->source_ref || !edge->target_ref) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "connection is missing source or target ref" };
        }

        if (strncmp(edge->source_ref, "input.", 6) == 0 && edge->source_ref[6] != '\0') {
            source_found = 1;
        }

        for (size_t n = 0; n < graph->node_count; n += 1) {
            if (!source_found && refs_node(edge->source_ref, graph->nodes[n].node_id)) {
                source_found = 1;
            }

            if (refs_node(edge->target_ref, graph->nodes[n].node_id)) {
                target_found = 1;
            }
        }

        if (!source_found) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown source node" };
        }

        if (!target_found) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown target node" };
        }
    }

    for (size_t i = 0; i < graph->output_count; i += 1) {
        int source_found = 0;

        if (!graph->outputs[i].source_ref) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "output binding is missing source ref" };
        }

        for (size_t n = 0; n < graph->node_count; n += 1) {
            if (refs_node(graph->outputs[i].source_ref, graph->nodes[n].node_id)) {
                source_found = 1;
                break;
            }
        }

        if (!source_found) {
            return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "unknown output source node" };
        }
    }

    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
