#ifndef PP_MANIFEST_H
#define PP_MANIFEST_H

#include <stddef.h>

#include "pp_packet.h"

typedef enum pp_param_type_e {
    PP_PARAM_INT = 1,
    PP_PARAM_FLOAT = 2,
    PP_PARAM_ENUM = 3
} pp_param_type_t;

typedef enum pp_port_cardinality_e {
    PP_PORT_ONE = 1,
    PP_PORT_MANY = 2
} pp_port_cardinality_t;

typedef struct pp_param_schema_s {
    const char *name;
    pp_param_type_t type;
    const char *default_value_json;
    double min_value;
    double max_value;
    const char *enum_values_csv;
} pp_param_schema_t;

typedef struct pp_input_port_def_s {
    const char *name;
    const pp_packet_kind_t *accepted_kinds;
    size_t accepted_kind_count;
    pp_port_cardinality_t cardinality;
} pp_input_port_def_t;

typedef struct pp_output_port_def_s {
    const char *name;
    pp_packet_kind_t emitted_kind;
} pp_output_port_def_t;

typedef struct pp_block_manifest_s {
    const char *block_id;
    const char *group_name;
    const pp_input_port_def_t *input_ports;
    size_t input_port_count;
    const pp_output_port_def_t *output_ports;
    size_t output_port_count;
    const pp_param_schema_t *params;
    size_t param_count;
    int stateful;
} pp_block_manifest_t;

#endif
