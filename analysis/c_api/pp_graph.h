#ifndef PP_GRAPH_H
#define PP_GRAPH_H

#include <stddef.h>

typedef struct pp_node_s {
    const char *node_id;
    const char *block_id;
    const char *params_json;
} pp_node_t;

typedef struct pp_connection_s {
    /* External graph entry points are referenced as input.<binding_name>. */
    const char *source_ref;
    const char *target_ref;
} pp_connection_t;

typedef struct pp_output_binding_s {
    const char *name;
    const char *source_ref;
} pp_output_binding_t;

typedef struct pp_graph_s {
    int schema_version;
    const pp_node_t *nodes;
    size_t node_count;
    const pp_connection_t *connections;
    size_t connection_count;
    const pp_output_binding_t *outputs;
    size_t output_count;
} pp_graph_t;

#endif
