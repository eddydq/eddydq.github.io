#include <string.h>

#include "../c_api/pp_runtime.h"

static int refs_node(const char *ref, const char *node_id) {
    if (!ref || !node_id || node_id[0] == '\0') {
        return 0;
    }

    size_t len = strlen(node_id);
    return strncmp(ref, node_id, len) == 0 && ref[len] == '.' && ref[len + 1] != '\0';
}

pp_runtime_result_t pp_graph_build_schedule(const pp_graph_t *graph, size_t *ordered_indexes, size_t ordered_capacity) {
    size_t indegree[PP_MAX_GRAPH_NODES] = {0};
    size_t queue[PP_MAX_GRAPH_NODES] = {0};
    size_t head = 0;
    size_t tail = 0;
    size_t written = 0;

    if (!graph || !ordered_indexes) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "graph or output buffer is null" };
    }

    if ((graph->node_count > 0 && graph->nodes == NULL) ||
        (graph->connection_count > 0 && graph->connections == NULL)) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "graph arrays are missing for non-zero counts" };
    }

    if (graph->node_count > PP_MAX_GRAPH_NODES || ordered_capacity < graph->node_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INTERNAL_ERROR, "graph too large for static scheduler buffers" };
    }

    for (size_t i = 0; i < graph->connection_count; i += 1) {
        for (size_t n = 0; n < graph->node_count; n += 1) {
            if (refs_node(graph->connections[i].target_ref, graph->nodes[n].node_id) &&
                strncmp(graph->connections[i].source_ref, "input.", 6) != 0) {
                indegree[n] += 1;
            }
        }
    }

    for (size_t n = 0; n < graph->node_count; n += 1) {
        if (indegree[n] == 0) {
            queue[tail++] = n;
        }
    }

    while (head < tail) {
        size_t index = queue[head++];
        ordered_indexes[written++] = index;

        for (size_t i = 0; i < graph->connection_count; i += 1) {
            if (!refs_node(graph->connections[i].source_ref, graph->nodes[index].node_id)) {
                continue;
            }

            for (size_t target = 0; target < graph->node_count; target += 1) {
                if (refs_node(graph->connections[i].target_ref, graph->nodes[target].node_id)) {
                    indegree[target] -= 1;
                    if (indegree[target] == 0) {
                        queue[tail++] = target;
                    }
                }
            }
        }
    }

    if (written != graph->node_count) {
        return (pp_runtime_result_t){ PP_RUNTIME_INVALID_GRAPH, "cycle detected in graph connections" };
    }

    return (pp_runtime_result_t){ PP_RUNTIME_OK, "ok" };
}
