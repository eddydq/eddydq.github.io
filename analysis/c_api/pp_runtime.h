#ifndef PP_RUNTIME_H
#define PP_RUNTIME_H

#include <stddef.h>

#include "pp_graph.h"
#include "pp_manifest.h"
#include "pp_packet.h"

#define PP_MAX_GRAPH_NODES 64

typedef enum pp_runtime_status_e {
    PP_RUNTIME_OK = 0,
    PP_RUNTIME_INVALID_GRAPH = 1,
    PP_RUNTIME_UNKNOWN_BLOCK = 2,
    PP_RUNTIME_PACKET_MISMATCH = 3,
    PP_RUNTIME_INTERNAL_ERROR = 4
} pp_runtime_status_t;

typedef struct pp_runtime_result_s {
    pp_runtime_status_t status;
    const char *message;
} pp_runtime_result_t;

typedef struct pp_runtime_output_packet_s {
    const char *binding_name;
    pp_packet_t packet;
} pp_runtime_output_packet_t;

typedef struct pp_runtime_input_packet_s {
    const char *binding_name;
    pp_packet_t packet;
} pp_runtime_input_packet_t;

typedef struct pp_port_packet_s {
    const char *port_name;
    pp_packet_t packet;
} pp_port_packet_t;

typedef pp_runtime_result_t (*pp_block_run_fn)(
    const pp_port_packet_t *inputs,
    size_t input_count,
    const char *params_json,
    void *state_buffer,
    pp_port_packet_t *outputs,
    size_t *output_count
);

typedef struct pp_block_descriptor_s {
    pp_block_manifest_t manifest;
    size_t state_size;
    pp_block_run_fn run;
} pp_block_descriptor_t;

const pp_block_descriptor_t *pp_find_block_descriptor(const char *block_id);
pp_runtime_result_t pp_graph_validate(const pp_graph_t *graph);
pp_runtime_result_t pp_graph_build_schedule(const pp_graph_t *graph, size_t *ordered_indexes, size_t ordered_capacity);
pp_runtime_result_t pp_runtime_run(
    const pp_graph_t *graph,
    const pp_runtime_input_packet_t *input_packets,
    size_t input_count,
    pp_runtime_output_packet_t *output_packets,
    size_t output_capacity,
    size_t *output_count
);

#endif
