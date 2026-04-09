#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../c_api/pp_runtime.h"

#define PP_WASM_MAX_NODES 16
#define PP_WASM_MAX_CONNECTIONS 32
#define PP_WASM_MAX_OUTPUTS 16
#define PP_WASM_MAX_INPUTS 8
#define PP_WASM_MAX_RESULTS 16

extern const pp_block_descriptor_t PP_BLOCK_SELECT_AXIS;
extern const pp_block_descriptor_t PP_BLOCK_AUTOCORRELATION;
extern const pp_block_descriptor_t PP_BLOCK_SPM_RANGE_GATE;
extern const pp_block_descriptor_t PP_BLOCK_KALMAN_2D;

static const pp_block_descriptor_t *PP_WASM_BLOCKS[] = {
    &PP_BLOCK_SELECT_AXIS,
    &PP_BLOCK_AUTOCORRELATION,
    &PP_BLOCK_SPM_RANGE_GATE,
    &PP_BLOCK_KALMAN_2D
};

static char g_catalog_json[16384];
static char g_result_json[32768];
static char g_string_pool[16384];
static size_t g_string_pool_used = 0;

static void reset_string_pool(void) {
    g_string_pool_used = 0;
    g_string_pool[0] = '\0';
}

static int pool_push_char(char value) {
    if (g_string_pool_used + 1 >= sizeof(g_string_pool)) {
        return 0;
    }

    g_string_pool[g_string_pool_used] = value;
    g_string_pool_used += 1;
    return 1;
}

static const char *pool_finish_string(size_t start) {
    if (g_string_pool_used >= sizeof(g_string_pool)) {
        return NULL;
    }

    g_string_pool[g_string_pool_used] = '\0';
    g_string_pool_used += 1;
    return &g_string_pool[start];
}

static const char *pool_copy_bytes(const char *source, size_t length) {
    size_t start = g_string_pool_used;

    if (g_string_pool_used + length + 1 >= sizeof(g_string_pool)) {
        return NULL;
    }

    memcpy(&g_string_pool[g_string_pool_used], source, length);
    g_string_pool_used += length;
    return pool_finish_string(start);
}

static const char *skip_ws(const char *cursor) {
    while (cursor && *cursor && isspace((unsigned char)*cursor)) {
        cursor += 1;
    }

    return cursor;
}

static int consume_char(const char **cursor, char expected) {
    *cursor = skip_ws(*cursor);
    if (**cursor != expected) {
        return 0;
    }

    *cursor += 1;
    return 1;
}

static int consume_literal(const char **cursor, const char *literal) {
    size_t length = strlen(literal);

    *cursor = skip_ws(*cursor);
    if (strncmp(*cursor, literal, length) != 0) {
        return 0;
    }

    *cursor += length;
    return 1;
}

static const char *parse_json_string(const char **cursor) {
    const char *p;
    size_t start;
    int escape = 0;

    *cursor = skip_ws(*cursor);
    if (**cursor != '"') {
        return NULL;
    }

    (*cursor) += 1;
    p = *cursor;
    start = g_string_pool_used;

    while (*p) {
        char ch = *p;

        if (escape) {
            switch (ch) {
                case '"':
                case '\\':
                case '/':
                    if (!pool_push_char(ch)) {
                        return NULL;
                    }
                    break;
                case 'b':
                    if (!pool_push_char('\b')) {
                        return NULL;
                    }
                    break;
                case 'f':
                    if (!pool_push_char('\f')) {
                        return NULL;
                    }
                    break;
                case 'n':
                    if (!pool_push_char('\n')) {
                        return NULL;
                    }
                    break;
                case 'r':
                    if (!pool_push_char('\r')) {
                        return NULL;
                    }
                    break;
                case 't':
                    if (!pool_push_char('\t')) {
                        return NULL;
                    }
                    break;
                default:
                    return NULL;
            }

            escape = 0;
            p += 1;
            continue;
        }

        if (ch == '\\') {
            escape = 1;
            p += 1;
            continue;
        }

        if (ch == '"') {
            *cursor = p + 1;
            return pool_finish_string(start);
        }

        if (!pool_push_char(ch)) {
            return NULL;
        }

        p += 1;
    }

    return NULL;
}

static const char *capture_json_object(const char **cursor) {
    const char *start;
    const char *p;
    int depth = 0;
    int in_string = 0;
    int escape = 0;

    *cursor = skip_ws(*cursor);
    if (**cursor != '{') {
        return NULL;
    }

    start = *cursor;
    p = *cursor;

    while (*p) {
        char ch = *p;

        if (in_string) {
            if (escape) {
                escape = 0;
            } else if (ch == '\\') {
                escape = 1;
            } else if (ch == '"') {
                in_string = 0;
            }

            p += 1;
            continue;
        }

        if (ch == '"') {
            in_string = 1;
        } else if (ch == '{') {
            depth += 1;
        } else if (ch == '}') {
            depth -= 1;
            if (depth == 0) {
                *cursor = p + 1;
                return pool_copy_bytes(start, (size_t)(p + 1 - start));
            }
        }

        p += 1;
    }

    return NULL;
}

static int parse_float_value(const char **cursor, float *out_value) {
    char *end_ptr = NULL;

    *cursor = skip_ws(*cursor);
    *out_value = strtof(*cursor, &end_ptr);
    if (end_ptr == *cursor) {
        return 0;
    }

    *cursor = end_ptr;
    return 1;
}

static int parse_size_t_value(const char **cursor, size_t *out_value) {
    char *end_ptr = NULL;

    *cursor = skip_ws(*cursor);
    *out_value = strtoul(*cursor, &end_ptr, 10);
    if (end_ptr == *cursor) {
        return 0;
    }

    *cursor = end_ptr;
    return 1;
}

static int parse_float_array(const char **cursor, float *values, size_t count) {
    size_t index = 0;

    if (!consume_char(cursor, '[')) {
        return 0;
    }

    if (consume_char(cursor, ']')) {
        return count == 0;
    }

    while (1) {
        if (index >= count || !parse_float_value(cursor, &values[index])) {
            return 0;
        }

        index += 1;
        if (consume_char(cursor, ']')) {
            return index == count;
        }

        if (!consume_char(cursor, ',')) {
            return 0;
        }
    }
}

static int append_text(char *buffer, size_t capacity, size_t *offset, const char *text) {
    size_t length = strlen(text);

    if (*offset + length >= capacity) {
        return 0;
    }

    memcpy(buffer + *offset, text, length);
    *offset += length;
    buffer[*offset] = '\0';
    return 1;
}

static int append_char(char *buffer, size_t capacity, size_t *offset, char value) {
    if (*offset + 1 >= capacity) {
        return 0;
    }

    buffer[*offset] = value;
    *offset += 1;
    buffer[*offset] = '\0';
    return 1;
}

static int append_formatted(char *buffer, size_t capacity, size_t *offset, const char *fmt, ...) {
    va_list args;
    int written;

    va_start(args, fmt);
    written = vsnprintf(buffer + *offset, capacity - *offset, fmt, args);
    va_end(args);

    if (written < 0 || (size_t)written >= capacity - *offset) {
        return 0;
    }

    *offset += (size_t)written;
    return 1;
}

static int append_json_string(char *buffer, size_t capacity, size_t *offset, const char *value) {
    const char *cursor = value ? value : "";

    if (!append_char(buffer, capacity, offset, '"')) {
        return 0;
    }

    while (*cursor) {
        char ch = *cursor;

        switch (ch) {
            case '"':
                if (!append_text(buffer, capacity, offset, "\\\"")) {
                    return 0;
                }
                break;
            case '\\':
                if (!append_text(buffer, capacity, offset, "\\\\")) {
                    return 0;
                }
                break;
            case '\n':
                if (!append_text(buffer, capacity, offset, "\\n")) {
                    return 0;
                }
                break;
            case '\r':
                if (!append_text(buffer, capacity, offset, "\\r")) {
                    return 0;
                }
                break;
            case '\t':
                if (!append_text(buffer, capacity, offset, "\\t")) {
                    return 0;
                }
                break;
            default:
                if (!append_char(buffer, capacity, offset, ch)) {
                    return 0;
                }
                break;
        }

        cursor += 1;
    }

    return append_char(buffer, capacity, offset, '"');
}

static int append_float_array_json(
    char *buffer,
    size_t capacity,
    size_t *offset,
    const float *values,
    size_t count
) {
    size_t i;

    if (!append_char(buffer, capacity, offset, '[')) {
        return 0;
    }

    for (i = 0; i < count; i += 1) {
        if (i > 0 && !append_char(buffer, capacity, offset, ',')) {
            return 0;
        }

        if (!append_formatted(buffer, capacity, offset, "%.6f", values[i])) {
            return 0;
        }
    }

    return append_char(buffer, capacity, offset, ']');
}

static const char *packet_kind_to_string(pp_packet_kind_t kind) {
    switch (kind) {
        case PP_PACKET_RAW_WINDOW:
            return "raw_window";
        case PP_PACKET_SERIES:
            return "series";
        case PP_PACKET_CANDIDATE:
            return "candidate";
        case PP_PACKET_ESTIMATE:
            return "estimate";
        default:
            return "unknown";
    }
}

static const char *param_type_to_string(pp_param_type_t type) {
    switch (type) {
        case PP_PARAM_INT:
            return "int";
        case PP_PARAM_FLOAT:
            return "float";
        case PP_PARAM_ENUM:
            return "enum";
        default:
            return "unknown";
    }
}

static const char *cardinality_to_string(pp_port_cardinality_t cardinality) {
    switch (cardinality) {
        case PP_PORT_ONE:
            return "one";
        case PP_PORT_MANY:
            return "many";
        default:
            return "unknown";
    }
}

static int append_csv_string_array(
    char *buffer,
    size_t capacity,
    size_t *offset,
    const char *csv
) {
    const char *token_start = csv;
    const char *cursor = csv;

    if (!append_char(buffer, capacity, offset, '[')) {
        return 0;
    }

    if (!csv || csv[0] == '\0') {
        return append_char(buffer, capacity, offset, ']');
    }

    while (1) {
        if (*cursor == ',' || *cursor == '\0') {
            size_t length = (size_t)(cursor - token_start);
            const char *token = pool_copy_bytes(token_start, length);

            if (!token) {
                return 0;
            }

            if (token_start != csv && !append_char(buffer, capacity, offset, ',')) {
                return 0;
            }

            if (!append_json_string(buffer, capacity, offset, token)) {
                return 0;
            }

            if (*cursor == '\0') {
                break;
            }

            token_start = cursor + 1;
        }

        cursor += 1;
    }

    return append_char(buffer, capacity, offset, ']');
}

static int append_param_json(
    char *buffer,
    size_t capacity,
    size_t *offset,
    const pp_param_schema_t *param
) {
    if (!append_char(buffer, capacity, offset, '{') ||
        !append_text(buffer, capacity, offset, "\"name\":") ||
        !append_json_string(buffer, capacity, offset, param->name) ||
        !append_text(buffer, capacity, offset, ",\"type\":") ||
        !append_json_string(buffer, capacity, offset, param_type_to_string(param->type)) ||
        !append_text(buffer, capacity, offset, ",\"default\":")) {
        return 0;
    }

    if (!append_text(buffer, capacity, offset, param->default_value_json ? param->default_value_json : "null") ||
        !append_text(buffer, capacity, offset, ",\"min\":") ||
        !append_formatted(buffer, capacity, offset, "%.6f", param->min_value) ||
        !append_text(buffer, capacity, offset, ",\"max\":") ||
        !append_formatted(buffer, capacity, offset, "%.6f", param->max_value) ||
        !append_text(buffer, capacity, offset, ",\"enum_values\":")) {
        return 0;
    }

    if (!append_csv_string_array(buffer, capacity, offset, param->enum_values_csv)) {
        return 0;
    }

    return append_char(buffer, capacity, offset, '}');
}

static int append_manifest_json(
    char *buffer,
    size_t capacity,
    size_t *offset,
    const pp_block_manifest_t *manifest
) {
    size_t i;

    if (!append_char(buffer, capacity, offset, '{') ||
        !append_text(buffer, capacity, offset, "\"block_id\":") ||
        !append_json_string(buffer, capacity, offset, manifest->block_id) ||
        !append_text(buffer, capacity, offset, ",\"group\":") ||
        !append_json_string(buffer, capacity, offset, manifest->group_name) ||
        !append_text(buffer, capacity, offset, ",\"inputs\":[")) {
        return 0;
    }

    for (i = 0; i < manifest->input_port_count; i += 1) {
        size_t kind_index;
        const pp_input_port_def_t *input_port = &manifest->input_ports[i];

        if (i > 0 && !append_char(buffer, capacity, offset, ',')) {
            return 0;
        }

        if (!append_char(buffer, capacity, offset, '{') ||
            !append_text(buffer, capacity, offset, "\"name\":") ||
            !append_json_string(buffer, capacity, offset, input_port->name) ||
            !append_text(buffer, capacity, offset, ",\"kinds\":[")) {
            return 0;
        }

        for (kind_index = 0; kind_index < input_port->accepted_kind_count; kind_index += 1) {
            if (kind_index > 0 && !append_char(buffer, capacity, offset, ',')) {
                return 0;
            }

            if (!append_json_string(
                buffer,
                capacity,
                offset,
                packet_kind_to_string(input_port->accepted_kinds[kind_index])
            )) {
                return 0;
            }
        }

        if (!append_text(buffer, capacity, offset, "],\"cardinality\":") ||
            !append_json_string(buffer, capacity, offset, cardinality_to_string(input_port->cardinality)) ||
            !append_char(buffer, capacity, offset, '}')) {
            return 0;
        }
    }

    if (!append_text(buffer, capacity, offset, "],\"outputs\":[")) {
        return 0;
    }

    for (i = 0; i < manifest->output_port_count; i += 1) {
        const pp_output_port_def_t *output_port = &manifest->output_ports[i];

        if (i > 0 && !append_char(buffer, capacity, offset, ',')) {
            return 0;
        }

        if (!append_char(buffer, capacity, offset, '{') ||
            !append_text(buffer, capacity, offset, "\"name\":") ||
            !append_json_string(buffer, capacity, offset, output_port->name) ||
            !append_text(buffer, capacity, offset, ",\"kind\":") ||
            !append_json_string(buffer, capacity, offset, packet_kind_to_string(output_port->emitted_kind)) ||
            !append_char(buffer, capacity, offset, '}')) {
            return 0;
        }
    }

    if (!append_text(buffer, capacity, offset, "],\"params\":[")) {
        return 0;
    }

    for (i = 0; i < manifest->param_count; i += 1) {
        if (i > 0 && !append_char(buffer, capacity, offset, ',')) {
            return 0;
        }

        if (!append_param_json(buffer, capacity, offset, &manifest->params[i])) {
            return 0;
        }
    }

    if (!append_text(buffer, capacity, offset, "],\"stateful\":")) {
        return 0;
    }

    if (!append_text(buffer, capacity, offset, manifest->stateful ? "true" : "false")) {
        return 0;
    }

    return append_char(buffer, capacity, offset, '}');
}

static int parse_raw_window_packet(const char **cursor, pp_packet_t *packet) {
    size_t length = 0;

    if (!consume_literal(cursor, "\"sample_rate_hz\":") ||
        !parse_float_value(cursor, &packet->payload.raw_window.sample_rate_hz) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"length\":") ||
        !parse_size_t_value(cursor, &length) ||
        length > PP_MAX_SERIES_SAMPLES ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"x\":") ||
        !parse_float_array(cursor, packet->payload.raw_window.x, length) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"y\":") ||
        !parse_float_array(cursor, packet->payload.raw_window.y, length) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"z\":") ||
        !parse_float_array(cursor, packet->payload.raw_window.z, length) ||
        !consume_char(cursor, '}')) {
        return 0;
    }

    packet->kind = PP_PACKET_RAW_WINDOW;
    packet->payload.raw_window.length = (uint16_t)length;
    return 1;
}

static int parse_series_packet(const char **cursor, pp_packet_t *packet) {
    const char *axis = NULL;
    size_t length = 0;

    if (!consume_literal(cursor, "\"sample_rate_hz\":") ||
        !parse_float_value(cursor, &packet->payload.series.sample_rate_hz) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"length\":") ||
        !parse_size_t_value(cursor, &length) ||
        length > PP_MAX_SERIES_SAMPLES ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"axis\":")) {
        return 0;
    }

    axis = parse_json_string(cursor);
    if (!axis ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"values\":") ||
        !parse_float_array(cursor, packet->payload.series.values, length) ||
        !consume_char(cursor, '}')) {
        return 0;
    }

    packet->kind = PP_PACKET_SERIES;
    packet->payload.series.length = (uint16_t)length;
    memset(packet->payload.series.axis, 0, sizeof(packet->payload.series.axis));
    strncpy(packet->payload.series.axis, axis, sizeof(packet->payload.series.axis) - 1);
    return 1;
}

static int parse_candidate_packet(const char **cursor, pp_packet_t *packet) {
    if (!consume_literal(cursor, "\"sample_rate_hz\":") ||
        !parse_float_value(cursor, &packet->payload.candidate.sample_rate_hz) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"spm\":") ||
        !parse_float_value(cursor, &packet->payload.candidate.spm) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"confidence\":") ||
        !parse_float_value(cursor, &packet->payload.candidate.confidence) ||
        !consume_char(cursor, '}')) {
        return 0;
    }

    packet->kind = PP_PACKET_CANDIDATE;
    return 1;
}

static int parse_estimate_packet(const char **cursor, pp_packet_t *packet) {
    if (!consume_literal(cursor, "\"sample_rate_hz\":") ||
        !parse_float_value(cursor, &packet->payload.estimate.sample_rate_hz) ||
        !consume_char(cursor, ',') ||
        !consume_literal(cursor, "\"spm\":") ||
        !parse_float_value(cursor, &packet->payload.estimate.spm) ||
        !consume_char(cursor, '}')) {
        return 0;
    }

    packet->kind = PP_PACKET_ESTIMATE;
    return 1;
}

static int parse_packet_object(const char **cursor, pp_packet_t *packet) {
    const char *kind = NULL;
    int wrapped = 0;
    int ok = 0;

    if (!consume_char(cursor, '{') || !consume_literal(cursor, "\"kind\":")) {
        return 0;
    }

    kind = parse_json_string(cursor);
    if (!kind) {
        return 0;
    }

    if (!consume_char(cursor, ',')) {
        return 0;
    }

    if (consume_literal(cursor, "\"data\":")) {
        if (!consume_char(cursor, '{')) {
            return 0;
        }
        wrapped = 1;
    }

    if (strcmp(kind, "raw_window") == 0) {
        ok = parse_raw_window_packet(cursor, packet);
    } else if (strcmp(kind, "series") == 0) {
        ok = parse_series_packet(cursor, packet);
    } else if (strcmp(kind, "candidate") == 0) {
        ok = parse_candidate_packet(cursor, packet);
    } else if (strcmp(kind, "estimate") == 0) {
        ok = parse_estimate_packet(cursor, packet);
    }

    if (!ok) {
        return 0;
    }

    if (wrapped) {
        return consume_char(cursor, '}');
    }

    return 1;
}

static int pp_parse_graph_json(
    const char *graph_json,
    pp_graph_t *graph,
    pp_node_t *nodes,
    size_t node_capacity,
    pp_connection_t *connections,
    size_t connection_capacity,
    pp_output_binding_t *outputs,
    size_t output_capacity
) {
    const char *cursor = graph_json;
    size_t node_count = 0;
    size_t connection_count = 0;
    size_t output_count = 0;

    reset_string_pool();

    if (!consume_char(&cursor, '{') ||
        !consume_literal(&cursor, "\"schema_version\":") ||
        !consume_literal(&cursor, "2") ||
        !consume_char(&cursor, ',') ||
        !consume_literal(&cursor, "\"nodes\":") ||
        !consume_char(&cursor, '[')) {
        return 0;
    }

    if (!consume_char(&cursor, ']')) {
        while (1) {
            if (node_count >= node_capacity ||
                !consume_char(&cursor, '{') ||
                !consume_literal(&cursor, "\"node_id\":")) {
                return 0;
            }

            nodes[node_count].node_id = parse_json_string(&cursor);
            if (!nodes[node_count].node_id ||
                !consume_char(&cursor, ',') ||
                !consume_literal(&cursor, "\"block_id\":")) {
                return 0;
            }

            nodes[node_count].block_id = parse_json_string(&cursor);
            if (!nodes[node_count].block_id ||
                !consume_char(&cursor, ',') ||
                !consume_literal(&cursor, "\"params\":")) {
                return 0;
            }

            nodes[node_count].params_json = capture_json_object(&cursor);
            if (!nodes[node_count].params_json || !consume_char(&cursor, '}')) {
                return 0;
            }

            node_count += 1;
            if (consume_char(&cursor, ']')) {
                break;
            }

            if (!consume_char(&cursor, ',')) {
                return 0;
            }
        }
    }

    if (!consume_char(&cursor, ',') ||
        !consume_literal(&cursor, "\"connections\":") ||
        !consume_char(&cursor, '[')) {
        return 0;
    }

    if (!consume_char(&cursor, ']')) {
        while (1) {
            if (connection_count >= connection_capacity ||
                !consume_char(&cursor, '{') ||
                !consume_literal(&cursor, "\"source\":")) {
                return 0;
            }

            connections[connection_count].source_ref = parse_json_string(&cursor);
            if (!connections[connection_count].source_ref ||
                !consume_char(&cursor, ',') ||
                !consume_literal(&cursor, "\"target\":")) {
                return 0;
            }

            connections[connection_count].target_ref = parse_json_string(&cursor);
            if (!connections[connection_count].target_ref || !consume_char(&cursor, '}')) {
                return 0;
            }

            connection_count += 1;
            if (consume_char(&cursor, ']')) {
                break;
            }

            if (!consume_char(&cursor, ',')) {
                return 0;
            }
        }
    }

    if (!consume_char(&cursor, ',') ||
        !consume_literal(&cursor, "\"outputs\":") ||
        !consume_char(&cursor, '{')) {
        return 0;
    }

    if (!consume_char(&cursor, '}')) {
        while (1) {
            if (output_count >= output_capacity) {
                return 0;
            }

            outputs[output_count].name = parse_json_string(&cursor);
            if (!outputs[output_count].name || !consume_char(&cursor, ':')) {
                return 0;
            }

            outputs[output_count].source_ref = parse_json_string(&cursor);
            if (!outputs[output_count].source_ref) {
                return 0;
            }

            output_count += 1;
            if (consume_char(&cursor, '}')) {
                break;
            }

            if (!consume_char(&cursor, ',')) {
                return 0;
            }
        }
    }

    if (!consume_char(&cursor, '}') || *skip_ws(cursor) != '\0') {
        return 0;
    }

    graph->schema_version = 2;
    graph->nodes = nodes;
    graph->node_count = node_count;
    graph->connections = connections;
    graph->connection_count = connection_count;
    graph->outputs = outputs;
    graph->output_count = output_count;
    return 1;
}

static int pp_parse_input_packets_json(
    const char *inputs_json,
    pp_runtime_input_packet_t *input_packets,
    size_t input_capacity,
    size_t *input_count
) {
    const char *cursor = inputs_json;
    size_t count = 0;

    if (!consume_char(&cursor, '[')) {
        return 0;
    }

    if (consume_char(&cursor, ']')) {
        *input_count = 0;
        return 1;
    }

    while (1) {
        if (count >= input_capacity ||
            !consume_char(&cursor, '{') ||
            !consume_literal(&cursor, "\"binding_name\":")) {
            return 0;
        }

        input_packets[count].binding_name = parse_json_string(&cursor);
        if (!input_packets[count].binding_name ||
            !consume_char(&cursor, ',') ||
            !consume_literal(&cursor, "\"packet\":") ||
            !parse_packet_object(&cursor, &input_packets[count].packet) ||
            !consume_char(&cursor, '}')) {
            return 0;
        }

        count += 1;
        if (consume_char(&cursor, ']')) {
            break;
        }

        if (!consume_char(&cursor, ',')) {
            return 0;
        }
    }

    if (*skip_ws(cursor) != '\0') {
        return 0;
    }

    *input_count = count;
    return 1;
}

static int append_packet_json(char *buffer, size_t capacity, size_t *offset, const pp_packet_t *packet) {
    if (!append_char(buffer, capacity, offset, '{') ||
        !append_text(buffer, capacity, offset, "\"kind\":") ||
        !append_json_string(buffer, capacity, offset, packet_kind_to_string(packet->kind)) ||
        !append_text(buffer, capacity, offset, ",\"data\":{")) {
        return 0;
    }

    switch (packet->kind) {
        case PP_PACKET_RAW_WINDOW:
            if (!append_text(buffer, capacity, offset, "\"sample_rate_hz\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.raw_window.sample_rate_hz) ||
                !append_text(buffer, capacity, offset, ",\"length\":") ||
                !append_formatted(buffer, capacity, offset, "%u", (unsigned)packet->payload.raw_window.length) ||
                !append_text(buffer, capacity, offset, ",\"x\":") ||
                !append_float_array_json(
                    buffer,
                    capacity,
                    offset,
                    packet->payload.raw_window.x,
                    packet->payload.raw_window.length
                ) ||
                !append_text(buffer, capacity, offset, ",\"y\":") ||
                !append_float_array_json(
                    buffer,
                    capacity,
                    offset,
                    packet->payload.raw_window.y,
                    packet->payload.raw_window.length
                ) ||
                !append_text(buffer, capacity, offset, ",\"z\":") ||
                !append_float_array_json(
                    buffer,
                    capacity,
                    offset,
                    packet->payload.raw_window.z,
                    packet->payload.raw_window.length
                )) {
                return 0;
            }
            break;
        case PP_PACKET_SERIES:
            if (!append_text(buffer, capacity, offset, "\"sample_rate_hz\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.series.sample_rate_hz) ||
                !append_text(buffer, capacity, offset, ",\"length\":") ||
                !append_formatted(buffer, capacity, offset, "%u", (unsigned)packet->payload.series.length) ||
                !append_text(buffer, capacity, offset, ",\"axis\":") ||
                !append_json_string(buffer, capacity, offset, packet->payload.series.axis) ||
                !append_text(buffer, capacity, offset, ",\"values\":") ||
                !append_float_array_json(
                    buffer,
                    capacity,
                    offset,
                    packet->payload.series.values,
                    packet->payload.series.length
                )) {
                return 0;
            }
            break;
        case PP_PACKET_CANDIDATE:
            if (!append_text(buffer, capacity, offset, "\"sample_rate_hz\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.candidate.sample_rate_hz) ||
                !append_text(buffer, capacity, offset, ",\"spm\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.candidate.spm) ||
                !append_text(buffer, capacity, offset, ",\"confidence\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.candidate.confidence)) {
                return 0;
            }
            break;
        case PP_PACKET_ESTIMATE:
            if (!append_text(buffer, capacity, offset, "\"sample_rate_hz\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.estimate.sample_rate_hz) ||
                !append_text(buffer, capacity, offset, ",\"spm\":") ||
                !append_formatted(buffer, capacity, offset, "%.6f", packet->payload.estimate.spm)) {
                return 0;
            }
            break;
        default:
            return 0;
    }

    return append_text(buffer, capacity, offset, "}}");
}

static void pp_format_run_result_json(
    const pp_runtime_output_packet_t *output_packets,
    size_t output_count,
    const pp_runtime_result_t *status,
    char *out_json,
    size_t out_capacity
) {
    size_t offset = 0;
    size_t index;

    out_json[0] = '\0';
    if (!append_text(out_json, out_capacity, &offset, "{\"outputs\":{")) {
        goto fail;
    }

    for (index = 0; index < output_count; index += 1) {
        if (index > 0 && !append_char(out_json, out_capacity, &offset, ',')) {
            goto fail;
        }

        if (!append_json_string(out_json, out_capacity, &offset, output_packets[index].binding_name) ||
            !append_char(out_json, out_capacity, &offset, ':') ||
            !append_char(out_json, out_capacity, &offset, '[') ||
            !append_packet_json(out_json, out_capacity, &offset, &output_packets[index].packet) ||
            !append_char(out_json, out_capacity, &offset, ']')) {
            goto fail;
        }
    }

    if (!append_text(out_json, out_capacity, &offset, "},\"diagnostics\":{") ||
        !append_text(out_json, out_capacity, &offset, "\"engine\":\"browser-runtime\"") ||
        !append_text(out_json, out_capacity, &offset, ",\"status\":") ||
        !append_json_string(out_json, out_capacity, &offset, status && status->status == PP_RUNTIME_OK ? "ok" : "error")) {
        goto fail;
    }

    if (status && status->message && status->message[0] != '\0') {
        if (!append_text(out_json, out_capacity, &offset, ",\"message\":") ||
            !append_json_string(out_json, out_capacity, &offset, status->message)) {
            goto fail;
        }
    }

    if (!append_text(out_json, out_capacity, &offset, "}}")) {
        goto fail;
    }

    return;

fail:
    snprintf(out_json, out_capacity, "{\"error\":\"failed to format runtime result\"}");
}

const char *pp_wasm_catalog_json(void) {
    size_t offset = 0;
    size_t index;

    reset_string_pool();
    g_catalog_json[0] = '\0';

    if (!append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "{\"system_inputs\":{") ||
        !append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "\"raw\":\"raw_window\",") ||
        !append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "\"series\":\"series\",") ||
        !append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "\"candidate\":\"candidate\",") ||
        !append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "\"estimate\":\"estimate\"") ||
        !append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "},\"blocks\":[")) {
        snprintf(g_catalog_json, sizeof(g_catalog_json), "{\"error\":\"failed to build catalog json\"}");
        return g_catalog_json;
    }

    for (index = 0; index < sizeof(PP_WASM_BLOCKS) / sizeof(PP_WASM_BLOCKS[0]); index += 1) {
        if (index > 0 && !append_char(g_catalog_json, sizeof(g_catalog_json), &offset, ',')) {
            snprintf(g_catalog_json, sizeof(g_catalog_json), "{\"error\":\"failed to build catalog json\"}");
            return g_catalog_json;
        }

        if (!append_manifest_json(
            g_catalog_json,
            sizeof(g_catalog_json),
            &offset,
            &PP_WASM_BLOCKS[index]->manifest
        )) {
            snprintf(g_catalog_json, sizeof(g_catalog_json), "{\"error\":\"failed to build catalog json\"}");
            return g_catalog_json;
        }
    }

    if (!append_text(g_catalog_json, sizeof(g_catalog_json), &offset, "]}")) {
        snprintf(g_catalog_json, sizeof(g_catalog_json), "{\"error\":\"failed to build catalog json\"}");
    }

    return g_catalog_json;
}

int pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json) {
    pp_node_t nodes[PP_WASM_MAX_NODES] = {0};
    pp_connection_t connections[PP_WASM_MAX_CONNECTIONS] = {0};
    pp_output_binding_t outputs[PP_WASM_MAX_OUTPUTS] = {0};
    pp_runtime_input_packet_t input_packets[PP_WASM_MAX_INPUTS] = {0};
    pp_runtime_output_packet_t result_packets[PP_WASM_MAX_RESULTS] = {0};
    pp_graph_t graph = {0};
    size_t input_count = 0;
    size_t output_count = 0;
    pp_runtime_result_t status;

    if (!graph_json || !inputs_json) {
        snprintf(g_result_json, sizeof(g_result_json), "{\"error\":\"missing graph or input json\"}");
        return (int)PP_RUNTIME_INVALID_GRAPH;
    }

    if (!pp_parse_graph_json(
        graph_json,
        &graph,
        nodes,
        PP_WASM_MAX_NODES,
        connections,
        PP_WASM_MAX_CONNECTIONS,
        outputs,
        PP_WASM_MAX_OUTPUTS
    )) {
        snprintf(g_result_json, sizeof(g_result_json), "{\"error\":\"failed to parse graph json\"}");
        return (int)PP_RUNTIME_INVALID_GRAPH;
    }

    if (!pp_parse_input_packets_json(inputs_json, input_packets, PP_WASM_MAX_INPUTS, &input_count)) {
        snprintf(g_result_json, sizeof(g_result_json), "{\"error\":\"failed to parse input json\"}");
        return (int)PP_RUNTIME_INVALID_GRAPH;
    }

    status = pp_runtime_run(&graph, input_packets, input_count, result_packets, PP_WASM_MAX_RESULTS, &output_count);
    if (status.status != PP_RUNTIME_OK) {
        size_t offset = 0;

        g_result_json[0] = '\0';
        if (!append_text(g_result_json, sizeof(g_result_json), &offset, "{\"error\":") ||
            !append_json_string(
                g_result_json,
                sizeof(g_result_json),
                &offset,
                status.message ? status.message : "runtime error"
            ) ||
            !append_text(g_result_json, sizeof(g_result_json), &offset, ",\"status\":") ||
            !append_formatted(g_result_json, sizeof(g_result_json), &offset, "%d", (int)status.status) ||
            !append_char(g_result_json, sizeof(g_result_json), &offset, '}')) {
            snprintf(g_result_json, sizeof(g_result_json), "{\"error\":\"runtime error\"}");
        }

        return (int)status.status;
    }

    pp_format_run_result_json(result_packets, output_count, &status, g_result_json, sizeof(g_result_json));
    return 0;
}

const char *pp_wasm_last_result_json(void) {
    return g_result_json;
}
