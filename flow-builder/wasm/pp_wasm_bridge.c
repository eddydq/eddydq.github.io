#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "pp_block.h"
#include "pp_graph.h"
#include "pp_protocol.h"

#define PP_WASM_CATALOG_CAP 32768U
#define PP_WASM_RESULT_CAP 65536U
#define PP_WASM_MAX_INPUTS 4U
#define PP_WASM_MAX_SYS_EDGES 16U
#define PP_WASM_MAX_OUTPUT_BINDINGS 8U
#define PP_WASM_MAX_PARAM_BYTES 16U
#define PP_WASM_MAX_STATE_BYTES 64U
#define PP_WASM_NODE_STORAGE_CAP PP_GRAPH_PACKET_CAPACITY
#define PP_WASM_RAW_STORAGE_CAP (PP_GRAPH_PACKET_CAPACITY * 3U)
#define PP_WASM_GRAPH_SCHEMA_VERSION 2

const char *pp_wasm_catalog_json(void);
int pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json);
const char *pp_wasm_last_result_json(void);

typedef struct {
    uint8_t block_id;
    const char *browser_id;
    const char *display_name;
    const char *group;
    const char *input_names[3];
    const char *output_names[3];
    const char *params_json;
} pp_wasm_block_meta_t;

typedef struct {
    char node_id[32];
    const pp_wasm_block_meta_t *meta;
    uint8_t params[PP_WASM_MAX_PARAM_BYTES];
    uint16_t params_len;
    uint8_t state[PP_WASM_MAX_STATE_BYTES];
    pp_packet_t outputs[3];
    uint8_t status;
} pp_wasm_node_t;

typedef struct {
    char binding_name[32];
    uint8_t dst_node;
    uint8_t dst_port;
} pp_wasm_sys_edge_t;

typedef struct {
    char binding_name[32];
    pp_packet_t packet;
} pp_wasm_input_t;

typedef struct {
    char binding_name[32];
    char node_id[32];
    char port_name[32];
} pp_wasm_output_binding_t;

static char s_catalog_json[PP_WASM_CATALOG_CAP];
static char s_last_result_json[PP_WASM_RESULT_CAP] = "{\"outputs\":{},\"diagnostics\":{}}";
static int16_t s_input_storage[PP_WASM_MAX_INPUTS][PP_WASM_RAW_STORAGE_CAP];
static int16_t s_node_storage[PP_MAX_NODES][3][PP_WASM_NODE_STORAGE_CAP];

static const pp_wasm_block_meta_t s_block_meta[] = {
    { PP_BLOCK_LIS3DH_SOURCE, "source.lis3dh", "LIS3DH Source", "source", {"", "", ""}, {"primary", "", ""}, "[{\"name\":\"sample_rate_hz\",\"type\":\"int\",\"default\":100,\"min\":1,\"max\":400,\"enum_values\":[]},{\"name\":\"resolution\",\"type\":\"int\",\"default\":12,\"min\":8,\"max\":12,\"enum_values\":[]}]" },
    { PP_BLOCK_MPU6050_SOURCE, "source.mpu6050", "MPU6050 Source", "source", {"", "", ""}, {"primary", "", ""}, "[{\"name\":\"sample_rate_hz\",\"type\":\"int\",\"default\":100,\"min\":4,\"max\":1000,\"enum_values\":[]},{\"name\":\"resolution\",\"type\":\"int\",\"default\":16,\"min\":16,\"max\":16,\"enum_values\":[]}]" },
    { PP_BLOCK_POLAR_SOURCE, "source.polar", "Polar Source", "source", {"", "", ""}, {"primary", "", ""}, "[{\"name\":\"axis_mask\",\"type\":\"int\",\"default\":7,\"min\":1,\"max\":7,\"enum_values\":[]}]" },
    { PP_BLOCK_SELECT_AXIS, "representation.select_axis", "Select Axis", "representation", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"axis\",\"type\":\"enum\",\"default\":\"z\",\"min\":0,\"max\":2,\"enum_values\":[\"x\",\"y\",\"z\"]}]" },
    { PP_BLOCK_VECTOR_MAG, "representation.vector_magnitude", "Vector Magnitude", "representation", {"source", "", ""}, {"primary", "", ""}, "[]" },
    { PP_BLOCK_HPF_GRAVITY, "pretraitement.hpf_gravity", "High-pass Gravity", "pretraitement", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"cutoff_hz\",\"type\":\"int\",\"default\":1,\"min\":1,\"max\":255,\"enum_values\":[]},{\"name\":\"order\",\"type\":\"int\",\"default\":1,\"min\":1,\"max\":4,\"enum_values\":[]}]" },
    { PP_BLOCK_LOWPASS, "pretraitement.lowpass", "Low-pass", "pretraitement", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"cutoff_hz\",\"type\":\"int\",\"default\":1,\"min\":1,\"max\":255,\"enum_values\":[]},{\"name\":\"order\",\"type\":\"int\",\"default\":1,\"min\":1,\"max\":4,\"enum_values\":[]}]" },
    { PP_BLOCK_AUTOCORRELATION, "estimation.autocorrelation", "Autocorrelation", "estimation", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"min_lag_samples\",\"type\":\"int\",\"default\":15,\"min\":1,\"max\":512,\"enum_values\":[]},{\"name\":\"max_lag_samples\",\"type\":\"int\",\"default\":160,\"min\":2,\"max\":512,\"enum_values\":[]},{\"name\":\"confidence_min\",\"type\":\"int\",\"default\":0,\"min\":0,\"max\":100,\"enum_values\":[]},{\"name\":\"harmonic_pct\",\"type\":\"int\",\"default\":80,\"min\":0,\"max\":100,\"enum_values\":[]}]" },
    { PP_BLOCK_FFT_DOMINANT, "estimation.fft_dominant", "FFT Dominant", "estimation", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"min_hz\",\"type\":\"int\",\"default\":0,\"min\":0,\"max\":255,\"enum_values\":[]},{\"name\":\"max_hz\",\"type\":\"int\",\"default\":5,\"min\":1,\"max\":255,\"enum_values\":[]},{\"name\":\"window_type\",\"type\":\"int\",\"default\":0,\"min\":0,\"max\":3,\"enum_values\":[]}]" },
    { PP_BLOCK_ADAPTIVE_PEAK, "detection.adaptive_peak_detect", "Adaptive Peak Detect", "detection", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"threshold_factor\",\"type\":\"int\",\"default\":8,\"min\":0,\"max\":255,\"enum_values\":[]},{\"name\":\"min_distance_samples\",\"type\":\"int\",\"default\":5,\"min\":1,\"max\":512,\"enum_values\":[]},{\"name\":\"decay_rate\",\"type\":\"int\",\"default\":200,\"min\":0,\"max\":255,\"enum_values\":[]}]" },
    { PP_BLOCK_ZERO_CROSSING, "detection.zero_crossing_detect", "Zero Crossing Detect", "detection", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"hysteresis\",\"type\":\"int\",\"default\":50,\"min\":-32768,\"max\":32767,\"enum_values\":[]},{\"name\":\"min_interval_samples\",\"type\":\"int\",\"default\":5,\"min\":1,\"max\":512,\"enum_values\":[]}]" },
    { PP_BLOCK_SPM_RANGE_GATE, "validation.spm_range_gate", "SPM Range Gate", "validation", {"source", "", ""}, {"accepted", "", ""}, "[{\"name\":\"min_spm\",\"type\":\"int\",\"default\":30,\"min\":0,\"max\":255,\"enum_values\":[]},{\"name\":\"max_spm\",\"type\":\"int\",\"default\":200,\"min\":0,\"max\":255,\"enum_values\":[]}]" },
    { PP_BLOCK_PEAK_SELECTOR, "validation.peak_selector", "Peak Selector", "validation", {"candidate", "series", ""}, {"primary", "", ""}, "[{\"name\":\"min_prominence\",\"type\":\"int\",\"default\":0,\"min\":-32768,\"max\":32767,\"enum_values\":[]},{\"name\":\"min_distance\",\"type\":\"int\",\"default\":1,\"min\":1,\"max\":512,\"enum_values\":[]}]" },
    { PP_BLOCK_CONFIDENCE_GATE, "validation.confidence_gate", "Confidence Gate", "validation", {"source", "", ""}, {"accepted", "rejected", ""}, "[{\"name\":\"min_confidence\",\"type\":\"int\",\"default\":0,\"min\":0,\"max\":100,\"enum_values\":[]},{\"name\":\"fallback_value\",\"type\":\"int\",\"default\":0,\"min\":-32768,\"max\":32767,\"enum_values\":[]}]" },
    { PP_BLOCK_KALMAN_2D, "suivi.kalman_2d", "Kalman 2D", "suivi", {"source", "", ""}, {"primary", "", ""}, "[{\"name\":\"q\",\"type\":\"int\",\"default\":256,\"min\":1,\"max\":65535,\"enum_values\":[]},{\"name\":\"r\",\"type\":\"int\",\"default\":256,\"min\":1,\"max\":65535,\"enum_values\":[]},{\"name\":\"p_max\",\"type\":\"int\",\"default\":10000,\"min\":1,\"max\":65535,\"enum_values\":[]},{\"name\":\"max_jump\",\"type\":\"int\",\"default\":20,\"min\":0,\"max\":255,\"enum_values\":[]}]" },
    { PP_BLOCK_CONFIRMATION, "suivi.confirmation_filter", "Confirmation Filter", "suivi", {"source", "", ""}, {"final", "", ""}, "[{\"name\":\"required_count\",\"type\":\"int\",\"default\":3,\"min\":1,\"max\":255,\"enum_values\":[]},{\"name\":\"tolerance_pct\",\"type\":\"int\",\"default\":10,\"min\":0,\"max\":100,\"enum_values\":[]}]" }
};

#define PP_WASM_BLOCK_META_COUNT (sizeof(s_block_meta) / sizeof(s_block_meta[0]))

static int json_append(char *buffer, size_t capacity, size_t *offset, const char *format, ...)
{
    va_list args;
    int written;

    if (*offset >= capacity) {
        return 0;
    }
    va_start(args, format);
    written = vsnprintf(&buffer[*offset], capacity - *offset, format, args);
    va_end(args);
    if (written < 0 || (size_t)written >= capacity - *offset) {
        *offset = capacity;
        if (capacity > 0U) {
            buffer[capacity - 1U] = '\0';
        }
        return 0;
    }
    *offset += (size_t)written;
    return 1;
}

static int json_append_string(char *buffer, size_t capacity, size_t *offset, const char *value)
{
    const unsigned char *p = (const unsigned char *)(value ? value : "");

    if (!json_append(buffer, capacity, offset, "\"")) {
        return 0;
    }
    while (*p) {
        unsigned char c = *p++;

        if (c == '"' || c == '\\') {
            if (!json_append(buffer, capacity, offset, "\\%c", c)) {
                return 0;
            }
        } else if (c == '\n') {
            if (!json_append(buffer, capacity, offset, "\\n")) {
                return 0;
            }
        } else if (c == '\r') {
            if (!json_append(buffer, capacity, offset, "\\r")) {
                return 0;
            }
        } else if (c == '\t') {
            if (!json_append(buffer, capacity, offset, "\\t")) {
                return 0;
            }
        } else if (c < 0x20U) {
            if (!json_append(buffer, capacity, offset, "\\u%04x", (unsigned)c)) {
                return 0;
            }
        } else {
            if (!json_append(buffer, capacity, offset, "%c", c)) {
                return 0;
            }
        }
    }
    return json_append(buffer, capacity, offset, "\"");
}

static void set_error(const char *format, ...)
{
    va_list args;
    size_t offset = 0;
    int written;

    offset += (size_t)snprintf(s_last_result_json, sizeof(s_last_result_json), "{\"error\":\"");
    va_start(args, format);
    written = vsnprintf(&s_last_result_json[offset], sizeof(s_last_result_json) - offset, format, args);
    va_end(args);
    if (written > 0) {
        offset += (size_t)written;
    }
    if (offset >= sizeof(s_last_result_json) - 3U) {
        offset = sizeof(s_last_result_json) - 3U;
    }
    s_last_result_json[offset++] = '"';
    s_last_result_json[offset++] = '}';
    s_last_result_json[offset] = '\0';
}

static const char *kind_name(uint8_t kind)
{
    switch (kind) {
    case PP_KIND_RAW_WINDOW:
        return "raw_window";
    case PP_KIND_SERIES:
        return "series";
    case PP_KIND_CANDIDATE:
        return "candidate";
    case PP_KIND_ESTIMATE:
        return "estimate";
    default:
        return "unknown";
    }
}

static const char *status_name(uint8_t status)
{
    switch (status) {
    case PP_OK:
        return "ok";
    case PP_SKIP:
        return "skip";
    default:
        return "error";
    }
}

static const pp_wasm_block_meta_t *find_meta_by_browser_id(const char *browser_id)
{
    size_t i;

    for (i = 0; i < PP_WASM_BLOCK_META_COUNT; i++) {
        if (strcmp(s_block_meta[i].browser_id, browser_id) == 0) {
            return &s_block_meta[i];
        }
    }
    return NULL;
}

static const char *fallback_input_name(uint8_t port)
{
    static const char *names[] = {"input0", "input1", "input2"};
    return port < 3U ? names[port] : "input";
}

static const char *fallback_output_name(uint8_t port)
{
    static const char *names[] = {"primary", "secondary", "tertiary"};
    return port < 3U ? names[port] : "output";
}

static int append_catalog_block(char *buffer, size_t capacity, size_t *offset, const pp_wasm_block_meta_t *meta)
{
    const pp_block_manifest_t *manifest = pp_block_get_manifest(meta->block_id);
    uint8_t i;

    if (!manifest) {
        set_error("missing firmware block manifest");
        return 0;
    }

    json_append(buffer, capacity, offset,
        "{\"firmware_block_id\":%u,\"block_id\":\"%s\",\"name\":\"%s\",\"group\":\"%s\",\"inputs\":[",
        (unsigned)meta->block_id,
        meta->browser_id,
        meta->display_name,
        meta->group);

    for (i = 0; i < manifest->num_inputs; i++) {
        const char *name = meta->input_names[i] && meta->input_names[i][0] ? meta->input_names[i] : fallback_input_name(i);
        if (i > 0U) {
            json_append(buffer, capacity, offset, ",");
        }
        json_append(buffer, capacity, offset,
            "{\"name\":\"%s\",\"kinds\":[\"%s\"],\"cardinality\":\"one\"}",
            name,
            kind_name(manifest->input_kinds[i]));
    }

    json_append(buffer, capacity, offset, "],\"outputs\":[");
    for (i = 0; i < manifest->num_outputs; i++) {
        const char *name = meta->output_names[i] && meta->output_names[i][0] ? meta->output_names[i] : fallback_output_name(i);
        if (i > 0U) {
            json_append(buffer, capacity, offset, ",");
        }
        json_append(buffer, capacity, offset,
            "{\"name\":\"%s\",\"kind\":\"%s\"}",
            name,
            kind_name(manifest->output_kinds[i]));
    }

    json_append(buffer, capacity, offset,
        "],\"params\":%s,\"stateful\":%s}",
        meta->params_json,
        manifest->state_size > 0U ? "true" : "false");
    return *offset < capacity;
}

const char *pp_wasm_catalog_json(void)
{
    size_t offset = 0;
    size_t i;

    (void)PP_PROTOCOL_VERSION;
    s_catalog_json[0] = '\0';
    json_append(s_catalog_json, sizeof(s_catalog_json), &offset,
        "{\"system_inputs\":{\"raw\":\"raw_window\",\"series\":\"series\",\"candidate\":\"candidate\",\"estimate\":\"estimate\"},\"blocks\":[");

    for (i = 0; i < PP_WASM_BLOCK_META_COUNT; i++) {
        if (i > 0U) {
            json_append(s_catalog_json, sizeof(s_catalog_json), &offset, ",");
        }
        if (!append_catalog_block(s_catalog_json, sizeof(s_catalog_json), &offset, &s_block_meta[i])) {
            return s_last_result_json;
        }
    }

    json_append(s_catalog_json, sizeof(s_catalog_json), &offset, "]}");
    return s_catalog_json;
}

static const char *skip_ws(const char *p)
{
    while (p && *p && isspace((unsigned char)*p)) {
        p++;
    }
    return p;
}

static const char *skip_json_string(const char *p, const char *end)
{
    if (!p || p >= end || *p != '"') {
        return NULL;
    }
    p++;
    while (p < end && *p) {
        if (*p == '\\') {
            p += 2;
            continue;
        }
        if (*p == '"') {
            return p + 1;
        }
        p++;
    }
    return NULL;
}

static int read_json_string(const char *p, const char *end, char *out, size_t out_size, const char **after)
{
    size_t used = 0;

    if (!p || p >= end || *p != '"' || out_size == 0U) {
        return 0;
    }
    p++;
    while (p < end && *p) {
        char c = *p++;
        if (c == '\\') {
            if (p >= end) {
                return 0;
            }
            c = *p++;
            if (c == 'n') {
                c = '\n';
            } else if (c == 't') {
                c = '\t';
            } else if (c == 'r') {
                c = '\r';
            }
        } else if (c == '"') {
            out[used] = '\0';
            if (after) {
                *after = p;
            }
            return 1;
        }

        if (used + 1U < out_size) {
            out[used++] = c;
        }
    }
    return 0;
}

static const char *match_bracket(const char *start, const char *end, char open_char, char close_char)
{
    const char *p = start;
    int depth = 0;

    if (!start || start >= end || *start != open_char) {
        return NULL;
    }
    while (p < end && *p) {
        if (*p == '"') {
            p = skip_json_string(p, end);
            if (!p) {
                return NULL;
            }
            continue;
        }
        if (*p == open_char) {
            depth++;
        } else if (*p == close_char) {
            depth--;
            if (depth == 0) {
                return p + 1;
            }
        }
        p++;
    }
    return NULL;
}

static int find_key_value(const char *object_begin, const char *object_end, const char *key, const char **value)
{
    const char *p = object_begin;
    int depth = 0;

    if (!object_begin || !object_end || object_begin >= object_end || *object_begin != '{') {
        return 0;
    }
    while (p < object_end && *p) {
        if (*p == '"') {
            char found_key[64];
            const char *after_key;
            if (!read_json_string(p, object_end, found_key, sizeof(found_key), &after_key)) {
                return 0;
            }
            if (depth == 1 && strcmp(found_key, key) == 0) {
                p = skip_ws(after_key);
                if (!p || p >= object_end || *p != ':') {
                    return 0;
                }
                *value = skip_ws(p + 1);
                return *value && *value < object_end;
            }
            p = after_key;
            continue;
        }
        if (*p == '{') {
            depth++;
        } else if (*p == '}') {
            depth--;
        }
        p++;
    }
    return 0;
}

static int get_object_value(const char *object_begin, const char *object_end, const char *key, const char **begin, const char **end)
{
    const char *value;
    const char *matched;

    if (!find_key_value(object_begin, object_end, key, &value) || *value != '{') {
        return 0;
    }
    matched = match_bracket(value, object_end, '{', '}');
    if (!matched) {
        return 0;
    }
    *begin = value;
    *end = matched;
    return 1;
}

static int get_array_value(const char *object_begin, const char *object_end, const char *key, const char **begin, const char **end)
{
    const char *value;
    const char *matched;

    if (!find_key_value(object_begin, object_end, key, &value) || *value != '[') {
        return 0;
    }
    matched = match_bracket(value, object_end, '[', ']');
    if (!matched) {
        return 0;
    }
    *begin = value;
    *end = matched;
    return 1;
}

static int get_string_value(const char *object_begin, const char *object_end, const char *key, char *out, size_t out_size)
{
    const char *value;

    if (!find_key_value(object_begin, object_end, key, &value)) {
        return 0;
    }
    return read_json_string(value, object_end, out, out_size, NULL);
}

static int get_int_value(const char *object_begin, const char *object_end, const char *key, int fallback)
{
    const char *value;
    char *parse_end;
    long parsed;

    if (!find_key_value(object_begin, object_end, key, &value)) {
        return fallback;
    }
    parsed = strtol(value, &parse_end, 10);
    if (parse_end == value) {
        return fallback;
    }
    return (int)parsed;
}

static int get_int_any(const char *object_begin, const char *object_end, const char *key_a, const char *key_b, int fallback)
{
    int value = get_int_value(object_begin, object_end, key_a, fallback);

    if (value == fallback && key_b) {
        value = get_int_value(object_begin, object_end, key_b, fallback);
    }
    return value;
}

static int validate_schema_version(const char *graph_json, const char *graph_end)
{
    const char *value;
    char *parse_end;
    long schema_version;

    if (!find_key_value(graph_json, graph_end, "schema_version", &value)) {
        set_error("missing schema_version");
        return 0;
    }

    schema_version = strtol(value, &parse_end, 10);
    if (parse_end == value) {
        set_error("schema_version must be numeric");
        return 0;
    }
    if (schema_version != PP_WASM_GRAPH_SCHEMA_VERSION) {
        set_error("unsupported schema_version");
        return 0;
    }

    return 1;
}

static uint8_t clamp_u8(int value)
{
    if (value < 0) {
        return 0;
    }
    if (value > 255) {
        return 255;
    }
    return (uint8_t)value;
}

static int16_t clamp_i16(int value)
{
    if (value < -32768) {
        return -32768;
    }
    if (value > 32767) {
        return 32767;
    }
    return (int16_t)value;
}

static uint16_t clamp_u16(int value)
{
    if (value < 0) {
        return 0;
    }
    if (value > 65535) {
        return 65535;
    }
    return (uint16_t)value;
}

static void write_u16(uint8_t *out, uint16_t value)
{
    out[0] = (uint8_t)(value & 0xFFU);
    out[1] = (uint8_t)(value >> 8);
}

static void write_i16(uint8_t *out, int16_t value)
{
    write_u16(out, (uint16_t)value);
}

static uint8_t encode_axis_param(const char *params_begin, const char *params_end)
{
    char axis[16];

    if (get_string_value(params_begin, params_end, "axis", axis, sizeof(axis))) {
        if (strcmp(axis, "x") == 0) {
            return PP_AXIS_X;
        }
        if (strcmp(axis, "y") == 0) {
            return PP_AXIS_Y;
        }
        if (strcmp(axis, "z") == 0) {
            return PP_AXIS_Z;
        }
        if (strcmp(axis, "mag") == 0) {
            return PP_AXIS_MAG;
        }
    }
    return clamp_u8(get_int_value(params_begin, params_end, "axis", PP_AXIS_Z));
}

static uint16_t encode_params(const pp_wasm_block_meta_t *meta, const char *params_begin, const char *params_end, uint8_t *out)
{
    const char empty_params[] = "{}";

    if (!params_begin || !params_end) {
        params_begin = empty_params;
        params_end = empty_params + strlen(empty_params);
    }

    switch (meta->block_id) {
    case PP_BLOCK_LIS3DH_SOURCE:
        write_u16(&out[0], clamp_u16(get_int_any(params_begin, params_end, "sample_rate_hz", "sampleRateHz", 100)));
        out[2] = clamp_u8(get_int_value(params_begin, params_end, "resolution", 12));
        return 3;
    case PP_BLOCK_MPU6050_SOURCE:
        write_u16(&out[0], clamp_u16(get_int_any(params_begin, params_end, "sample_rate_hz", "sampleRateHz", 100)));
        out[2] = clamp_u8(get_int_value(params_begin, params_end, "resolution", 16));
        return 3;
    case PP_BLOCK_POLAR_SOURCE:
        out[0] = clamp_u8(get_int_any(params_begin, params_end, "axis_mask", "axisMask", 7));
        return 1;
    case PP_BLOCK_SELECT_AXIS:
        out[0] = encode_axis_param(params_begin, params_end);
        return 1;
    case PP_BLOCK_VECTOR_MAG:
        return 0;
    case PP_BLOCK_HPF_GRAVITY:
    case PP_BLOCK_LOWPASS:
        out[0] = clamp_u8(get_int_any(params_begin, params_end, "cutoff_hz", "cutoffHz", 1));
        out[1] = clamp_u8(get_int_value(params_begin, params_end, "order", 1));
        return 2;
    case PP_BLOCK_AUTOCORRELATION:
        write_u16(&out[0], clamp_u16(get_int_any(params_begin, params_end, "min_lag", "min_lag_samples", 15)));
        write_u16(&out[2], clamp_u16(get_int_any(params_begin, params_end, "max_lag", "max_lag_samples", 160)));
        out[4] = clamp_u8(get_int_value(params_begin, params_end, "confidence_min", 0));
        out[5] = clamp_u8(get_int_value(params_begin, params_end, "harmonic_pct", 80));
        return 6;
    case PP_BLOCK_FFT_DOMINANT:
        out[0] = clamp_u8(get_int_any(params_begin, params_end, "min_hz", "minHz", 0));
        out[1] = clamp_u8(get_int_any(params_begin, params_end, "max_hz", "maxHz", 5));
        out[2] = clamp_u8(get_int_any(params_begin, params_end, "window_type", "windowType", 0));
        return 3;
    case PP_BLOCK_ADAPTIVE_PEAK:
        out[0] = clamp_u8(get_int_value(params_begin, params_end, "threshold_factor", 8));
        write_u16(&out[1], clamp_u16(get_int_any(params_begin, params_end, "min_distance", "min_distance_samples", 5)));
        out[3] = clamp_u8(get_int_value(params_begin, params_end, "decay_rate", 200));
        return 4;
    case PP_BLOCK_ZERO_CROSSING:
        write_i16(&out[0], clamp_i16(get_int_value(params_begin, params_end, "hysteresis", 50)));
        write_u16(&out[2], clamp_u16(get_int_any(params_begin, params_end, "min_interval", "min_interval_samples", 5)));
        return 4;
    case PP_BLOCK_SPM_RANGE_GATE:
        out[0] = clamp_u8(get_int_value(params_begin, params_end, "min_spm", 30));
        out[1] = clamp_u8(get_int_value(params_begin, params_end, "max_spm", 200));
        return 2;
    case PP_BLOCK_PEAK_SELECTOR:
        write_i16(&out[0], clamp_i16(get_int_value(params_begin, params_end, "min_prominence", 0)));
        write_u16(&out[2], clamp_u16(get_int_value(params_begin, params_end, "min_distance", 1)));
        return 4;
    case PP_BLOCK_CONFIDENCE_GATE:
        out[0] = clamp_u8(get_int_value(params_begin, params_end, "min_confidence", 0));
        write_i16(&out[1], clamp_i16(get_int_value(params_begin, params_end, "fallback_value", 0)));
        return 3;
    case PP_BLOCK_KALMAN_2D:
        write_u16(&out[0], clamp_u16(get_int_value(params_begin, params_end, "q", 256)));
        write_u16(&out[2], clamp_u16(get_int_value(params_begin, params_end, "r", 256)));
        write_u16(&out[4], clamp_u16(get_int_value(params_begin, params_end, "p_max", 10000)));
        out[6] = clamp_u8(get_int_value(params_begin, params_end, "max_jump", 20));
        return 7;
    case PP_BLOCK_CONFIRMATION:
        out[0] = clamp_u8(get_int_value(params_begin, params_end, "required_count", 3));
        out[1] = clamp_u8(get_int_value(params_begin, params_end, "tolerance_pct", 10));
        return 2;
    default:
        return 0;
    }
}

static int find_node_index(const pp_wasm_node_t *nodes, uint8_t node_count, const char *node_id)
{
    uint8_t i;

    for (i = 0; i < node_count; i++) {
        if (strcmp(nodes[i].node_id, node_id) == 0) {
            return i;
        }
    }
    return -1;
}

static int port_index_by_name(const char *const names[3], uint8_t count, const char *port_name, int default_port)
{
    uint8_t i;

    if (!port_name || !port_name[0]) {
        return default_port;
    }
    for (i = 0; i < count && i < 3U; i++) {
        if (names[i] && names[i][0] && strcmp(names[i], port_name) == 0) {
            return i;
        }
    }
    if (strcmp(port_name, "primary") == 0 || strcmp(port_name, "source") == 0) {
        return 0;
    }
    return -1;
}

static void split_ref(const char *ref, char *node_id, size_t node_id_size, char *port_name, size_t port_name_size)
{
    const char *dot = strchr(ref, '.');
    size_t node_len;

    if (!dot) {
        snprintf(node_id, node_id_size, "%s", ref);
        snprintf(port_name, port_name_size, "%s", "primary");
        return;
    }
    node_len = (size_t)(dot - ref);
    if (node_len >= node_id_size) {
        node_len = node_id_size - 1U;
    }
    memcpy(node_id, ref, node_len);
    node_id[node_len] = '\0';
    snprintf(port_name, port_name_size, "%s", dot + 1);
}

static int ref_has_named_port(const char *ref)
{
    const char *dot = strchr(ref, '.');
    return dot && dot[1] != '\0';
}

static int parse_nodes(const char *graph_json, const char *graph_end, pp_graph_t *graph, pp_wasm_node_t *nodes)
{
    const char *array_begin;
    const char *array_end;
    const char *p;
    uint8_t node_count = 0;

    if (!get_array_value(graph_json, graph_end, "nodes", &array_begin, &array_end)) {
        set_error("graph nodes array is missing");
        return 0;
    }

    p = array_begin + 1;
    memset(graph, 0, sizeof(*graph));
    memset(nodes, 0, sizeof(pp_wasm_node_t) * PP_MAX_NODES);

    while (p < array_end) {
        const char *node_begin;
        const char *node_end;
        const char *params_begin = NULL;
        const char *params_end = NULL;
        char block_id[96];
        char node_id[32];
        const pp_wasm_block_meta_t *meta;
        int numeric_id;

        p = skip_ws(p);
        if (!p || p >= array_end || *p == ']') {
            break;
        }
        if (*p == ',') {
            p++;
            continue;
        }
        if (*p != '{') {
            set_error("graph nodes array contains a non-object");
            return 0;
        }
        node_begin = p;
        node_end = match_bracket(node_begin, array_end, '{', '}');
        if (!node_end) {
            set_error("graph node object is malformed");
            return 0;
        }
        if (node_count >= PP_MAX_NODES) {
            set_error("graph has too many nodes");
            return 0;
        }
        if (!get_string_value(node_begin, node_end, "block_id", block_id, sizeof(block_id)) &&
            !get_string_value(node_begin, node_end, "blockId", block_id, sizeof(block_id))) {
            set_error("graph node is missing block_id");
            return 0;
        }
        meta = find_meta_by_browser_id(block_id);
        if (!meta) {
            set_error("unknown block id");
            return 0;
        }
        if (!get_string_value(node_begin, node_end, "node_id", node_id, sizeof(node_id))) {
            numeric_id = get_int_value(node_begin, node_end, "id", (int)node_count);
            snprintf(node_id, sizeof(node_id), "%d", numeric_id);
        }

        snprintf(nodes[node_count].node_id, sizeof(nodes[node_count].node_id), "%s", node_id);
        nodes[node_count].meta = meta;
        get_object_value(node_begin, node_end, "params", &params_begin, &params_end);
        nodes[node_count].params_len = encode_params(meta, params_begin, params_end, nodes[node_count].params);

        graph->nodes[node_count].block_id = meta->block_id;
        graph->nodes[node_count].params = nodes[node_count].params;
        graph->nodes[node_count].params_len = nodes[node_count].params_len;
        graph->nodes[node_count].state = nodes[node_count].state;
        node_count++;
        p = node_end;
    }

    graph->node_count = node_count;
    return 1;
}

static int add_graph_edge(pp_graph_t *graph, uint8_t src, uint8_t src_port, uint8_t dst, uint8_t dst_port)
{
    if (graph->edge_count >= PP_MAX_EDGES) {
        set_error("graph has too many edges");
        return 0;
    }
    graph->edges[graph->edge_count].src_node = src;
    graph->edges[graph->edge_count].src_port = src_port;
    graph->edges[graph->edge_count].dst_node = dst;
    graph->edges[graph->edge_count].dst_port = dst_port;
    graph->edge_count++;
    return 1;
}

static int add_sys_edge(pp_wasm_sys_edge_t *sys_edges, uint8_t *sys_edge_count, const char *binding_name, uint8_t dst, uint8_t dst_port)
{
    if (*sys_edge_count >= PP_WASM_MAX_SYS_EDGES) {
        set_error("graph has too many system input edges");
        return 0;
    }
    snprintf(sys_edges[*sys_edge_count].binding_name, sizeof(sys_edges[*sys_edge_count].binding_name), "%s", binding_name);
    sys_edges[*sys_edge_count].dst_node = dst;
    sys_edges[*sys_edge_count].dst_port = dst_port;
    (*sys_edge_count)++;
    return 1;
}

static int parse_connection_edges(
    const char *array_begin,
    const char *array_end,
    pp_graph_t *graph,
    pp_wasm_node_t *nodes,
    pp_wasm_sys_edge_t *sys_edges,
    uint8_t *sys_edge_count)
{
    const char *p = array_begin + 1;

    while (p < array_end) {
        const char *edge_begin;
        const char *edge_end;
        char source_ref[96];
        char target_ref[96];
        char src_node_id[32];
        char src_port_name[32];
        char dst_node_id[32];
        char dst_port_name[32];
        int source_has_named_port;
        int target_has_named_port;
        int dst_index;
        int dst_port;
        int src_port;

        p = skip_ws(p);
        if (!p || p >= array_end || *p == ']') {
            break;
        }
        if (*p == ',') {
            p++;
            continue;
        }
        if (*p != '{') {
            set_error("connection entry is malformed");
            return 0;
        }
        edge_begin = p;
        edge_end = match_bracket(edge_begin, array_end, '{', '}');
        if (!edge_end) {
            set_error("connection object is malformed");
            return 0;
        }
        if (!get_string_value(edge_begin, edge_end, "source", source_ref, sizeof(source_ref)) ||
            !get_string_value(edge_begin, edge_end, "target", target_ref, sizeof(target_ref))) {
            set_error("connection is missing source or target");
            return 0;
        }

        source_has_named_port = ref_has_named_port(source_ref);
        target_has_named_port = ref_has_named_port(target_ref);
        split_ref(source_ref, src_node_id, sizeof(src_node_id), src_port_name, sizeof(src_port_name));
        split_ref(target_ref, dst_node_id, sizeof(dst_node_id), dst_port_name, sizeof(dst_port_name));
        if (strcmp(dst_node_id, "output") == 0) {
            p = edge_end;
            continue;
        }

        dst_index = find_node_index(nodes, graph->node_count, dst_node_id);
        if (dst_index < 0) {
            set_error("connection targets an unknown node");
            return 0;
        }
        dst_port = port_index_by_name(nodes[dst_index].meta->input_names, 3, dst_port_name, 0);
        if (!target_has_named_port) {
            dst_port = get_int_value(edge_begin, edge_end, "target_socket", dst_port);
        }
        if (dst_port < 0 || dst_port > 2) {
            set_error("connection targets an unknown input port");
            return 0;
        }

        if (strcmp(src_node_id, "input") == 0) {
            if (!add_sys_edge(sys_edges, sys_edge_count, src_port_name, (uint8_t)dst_index, (uint8_t)dst_port)) {
                return 0;
            }
            p = edge_end;
            continue;
        }

        {
            int src_index = find_node_index(nodes, graph->node_count, src_node_id);
            if (src_index < 0) {
                set_error("connection sources an unknown node");
                return 0;
            }
            src_port = port_index_by_name(nodes[src_index].meta->output_names, 3, src_port_name, 0);
            if (!source_has_named_port) {
                src_port = get_int_value(edge_begin, edge_end, "source_socket", src_port);
            }
            if (src_port < 0 || src_port > 2) {
                set_error("connection sources an unknown output port");
                return 0;
            }
            if (!add_graph_edge(graph, (uint8_t)src_index, (uint8_t)src_port, (uint8_t)dst_index, (uint8_t)dst_port)) {
                return 0;
            }
        }
        p = edge_end;
    }
    return 1;
}

static int parse_numeric_edges(const char *array_begin, const char *array_end, pp_graph_t *graph)
{
    const char *p = array_begin + 1;

    while (p < array_end) {
        const char *edge_begin;
        const char *edge_end;
        int src;
        int dst;
        int src_port;
        int dst_port;

        p = skip_ws(p);
        if (!p || p >= array_end || *p == ']') {
            break;
        }
        if (*p == ',') {
            p++;
            continue;
        }
        if (*p != '{') {
            set_error("edge entry is malformed");
            return 0;
        }
        edge_begin = p;
        edge_end = match_bracket(edge_begin, array_end, '{', '}');
        if (!edge_end) {
            set_error("edge object is malformed");
            return 0;
        }
        src = get_int_value(edge_begin, edge_end, "src", -1);
        dst = get_int_value(edge_begin, edge_end, "dst", -1);
        src_port = get_int_any(edge_begin, edge_end, "srcPort", "src_port", 0);
        dst_port = get_int_any(edge_begin, edge_end, "dstPort", "dst_port", 0);
        if (src < 0 || dst < 0 || src >= graph->node_count || dst >= graph->node_count) {
            set_error("numeric edge references an unknown node");
            return 0;
        }
        if (!add_graph_edge(graph, (uint8_t)src, (uint8_t)src_port, (uint8_t)dst, (uint8_t)dst_port)) {
            return 0;
        }
        p = edge_end;
    }
    return 1;
}

static int parse_edges(
    const char *graph_json,
    const char *graph_end,
    pp_graph_t *graph,
    pp_wasm_node_t *nodes,
    pp_wasm_sys_edge_t *sys_edges,
    uint8_t *sys_edge_count)
{
    const char *array_begin;
    const char *array_end;

    *sys_edge_count = 0;
    if (get_array_value(graph_json, graph_end, "connections", &array_begin, &array_end)) {
        if (!parse_connection_edges(array_begin, array_end, graph, nodes, sys_edges, sys_edge_count)) {
            return 0;
        }
    }
    if (get_array_value(graph_json, graph_end, "edges", &array_begin, &array_end)) {
        if (!parse_numeric_edges(array_begin, array_end, graph)) {
            return 0;
        }
    }
    return 1;
}

static int get_array_int_at(const char *object_begin, const char *object_end, const char *key, uint16_t index, int fallback)
{
    const char *array_begin;
    const char *array_end;
    const char *p;
    uint16_t current = 0;

    if (!get_array_value(object_begin, object_end, key, &array_begin, &array_end)) {
        return fallback;
    }
    p = array_begin + 1;
    while (p < array_end) {
        char *after_number;
        long parsed;

        p = skip_ws(p);
        if (!p || p >= array_end || *p == ']') {
            break;
        }
        if (*p == ',') {
            p++;
            continue;
        }
        parsed = strtol(p, &after_number, 10);
        if (after_number == p) {
            return fallback;
        }
        if (current == index) {
            return (int)parsed;
        }
        current++;
        p = after_number;
    }
    return fallback;
}

static int parse_input_packet(const char *packet_begin, const char *packet_end, pp_packet_t *packet, int16_t *storage)
{
    const char *data_begin;
    const char *data_end;
    char kind[32];
    int sample_rate_hz;
    int length;
    uint16_t i;

    if (!get_string_value(packet_begin, packet_end, "kind", kind, sizeof(kind)) ||
        !get_object_value(packet_begin, packet_end, "data", &data_begin, &data_end)) {
        set_error("input packet is missing kind or data");
        return 0;
    }

    sample_rate_hz = get_int_value(data_begin, data_end, "sample_rate_hz", 0);
    length = get_int_value(data_begin, data_end, "length", 0);
    if (length < 0) {
        length = 0;
    }
    if (length > (int)PP_GRAPH_PACKET_CAPACITY) {
        length = (int)PP_GRAPH_PACKET_CAPACITY;
    }

    memset(packet, 0, sizeof(*packet));
    packet->data = storage;
    packet->axis = PP_AXIS_ALL;
    packet->sample_rate_hz = clamp_u16(sample_rate_hz);

    if (strcmp(kind, "raw_window") == 0) {
        for (i = 0; i < (uint16_t)length; i++) {
            storage[(uint16_t)(i * 3U + 0U)] = clamp_i16(get_array_int_at(data_begin, data_end, "x", i, 0));
            storage[(uint16_t)(i * 3U + 1U)] = clamp_i16(get_array_int_at(data_begin, data_end, "y", i, 0));
            storage[(uint16_t)(i * 3U + 2U)] = clamp_i16(get_array_int_at(data_begin, data_end, "z", i, 0));
        }
        packet->length = (uint16_t)(length * 3);
        packet->kind = PP_KIND_RAW_WINDOW;
        return 1;
    }

    for (i = 0; i < (uint16_t)length; i++) {
        storage[i] = clamp_i16(get_array_int_at(data_begin, data_end, "values", i, 0));
    }
    packet->length = (uint16_t)length;
    if (strcmp(kind, "series") == 0) {
        packet->kind = PP_KIND_SERIES;
    } else if (strcmp(kind, "candidate") == 0) {
        packet->kind = PP_KIND_CANDIDATE;
    } else if (strcmp(kind, "estimate") == 0) {
        packet->kind = PP_KIND_ESTIMATE;
    } else {
        set_error("unsupported input packet kind");
        return 0;
    }
    return 1;
}

static int parse_inputs(const char *inputs_json, pp_wasm_input_t *inputs, uint8_t *input_count)
{
    const char *input_end;
    const char *array_end;
    const char *p;

    *input_count = 0;
    if (!inputs_json) {
        return 1;
    }
    input_end = inputs_json + strlen(inputs_json);
    p = skip_ws(inputs_json);
    if (!p || *p == '\0') {
        return 1;
    }
    if (*p != '[') {
        set_error("inputs JSON must be an array");
        return 0;
    }
    array_end = match_bracket(p, input_end, '[', ']');
    if (!array_end) {
        set_error("inputs JSON is malformed");
        return 0;
    }
    p++;

    while (p < array_end) {
        const char *input_begin;
        const char *input_object_end;
        const char *packet_begin;
        const char *packet_end;

        p = skip_ws(p);
        if (!p || p >= array_end || *p == ']') {
            break;
        }
        if (*p == ',') {
            p++;
            continue;
        }
        if (*p != '{') {
            set_error("input entry is malformed");
            return 0;
        }
        if (*input_count >= PP_WASM_MAX_INPUTS) {
            set_error("too many input packets");
            return 0;
        }
        input_begin = p;
        input_object_end = match_bracket(input_begin, array_end, '{', '}');
        if (!input_object_end) {
            set_error("input object is malformed");
            return 0;
        }
        if (!get_string_value(input_begin, input_object_end, "binding_name", inputs[*input_count].binding_name, sizeof(inputs[*input_count].binding_name)) &&
            !get_string_value(input_begin, input_object_end, "bindingName", inputs[*input_count].binding_name, sizeof(inputs[*input_count].binding_name))) {
            set_error("input object is missing binding_name");
            return 0;
        }
        if (!get_object_value(input_begin, input_object_end, "packet", &packet_begin, &packet_end)) {
            set_error("input object is missing packet");
            return 0;
        }
        if (!parse_input_packet(packet_begin, packet_end, &inputs[*input_count].packet, s_input_storage[*input_count])) {
            return 0;
        }
        (*input_count)++;
        p = input_object_end;
    }
    return 1;
}

static const pp_packet_t *find_input_packet(const pp_wasm_input_t *inputs, uint8_t input_count, const char *binding_name)
{
    uint8_t i;

    for (i = 0; i < input_count; i++) {
        if (strcmp(inputs[i].binding_name, binding_name) == 0) {
            return &inputs[i].packet;
        }
    }
    return NULL;
}

static int execute_graph(
    pp_graph_t *graph,
    pp_wasm_node_t *nodes,
    const pp_wasm_sys_edge_t *sys_edges,
    uint8_t sys_edge_count,
    const pp_wasm_input_t *inputs,
    uint8_t input_count)
{
    uint8_t order_index;

    if (pp_graph_validate_ports(graph) != PP_OK || pp_graph_topo_sort(graph) != PP_OK) {
        set_error("graph validation failed");
        return 0;
    }

    for (order_index = 0; order_index < graph->node_count; order_index++) {
        uint8_t node_index = graph->exec_order[order_index];
        pp_wasm_node_t *node;
        const pp_block_manifest_t *manifest;
        pp_packet_t node_inputs[3];
        pp_packet_t node_outputs[3];
        uint8_t provided_inputs[3] = {0, 0, 0};
        uint8_t num_inputs = 0;
        uint8_t edge_index;
        uint8_t port;
        pp_block_result_t result;

        if (node_index >= graph->node_count) {
            set_error("topological order references an unknown node");
            return 0;
        }
        node = &nodes[node_index];
        manifest = pp_block_get_manifest(node->meta->block_id);
        if (!manifest) {
            set_error("node firmware manifest is missing");
            return 0;
        }

        memset(node_inputs, 0, sizeof(node_inputs));
        memset(node_outputs, 0, sizeof(node_outputs));

        for (edge_index = 0; edge_index < graph->edge_count; edge_index++) {
            const pp_edge_t *edge = &graph->edges[edge_index];
            if (edge->dst_node == node_index && edge->dst_port < 3U && edge->src_node < graph->node_count) {
                node_inputs[edge->dst_port] = nodes[edge->src_node].outputs[edge->src_port];
                provided_inputs[edge->dst_port] = 1;
                if ((uint8_t)(edge->dst_port + 1U) > num_inputs) {
                    num_inputs = (uint8_t)(edge->dst_port + 1U);
                }
            }
        }

        for (edge_index = 0; edge_index < sys_edge_count; edge_index++) {
            if (sys_edges[edge_index].dst_node == node_index && sys_edges[edge_index].dst_port < 3U) {
                const pp_packet_t *packet = find_input_packet(inputs, input_count, sys_edges[edge_index].binding_name);
                if (!packet) {
                    set_error("missing system input packet");
                    return 0;
                }
                node_inputs[sys_edges[edge_index].dst_port] = *packet;
                provided_inputs[sys_edges[edge_index].dst_port] = 1;
                if ((uint8_t)(sys_edges[edge_index].dst_port + 1U) > num_inputs) {
                    num_inputs = (uint8_t)(sys_edges[edge_index].dst_port + 1U);
                }
            }
        }

        for (port = 0; port < manifest->num_inputs && port < 3U; port++) {
            if (!provided_inputs[port]) {
                set_error("node input is not connected");
                return 0;
            }
        }

        for (port = 0; port < manifest->num_outputs && port < 3U; port++) {
            node_outputs[port].data = s_node_storage[node_index][port];
            node_outputs[port].length = PP_WASM_NODE_STORAGE_CAP;
            node_outputs[port].kind = manifest->output_kinds[port];
            node_outputs[port].axis = PP_AXIS_ALL;
            node_outputs[port].sample_rate_hz = 0;
        }

        result = pp_block_exec(
            node->meta->block_id,
            node_inputs,
            num_inputs,
            node->params,
            node->params_len,
            node->state,
            node_outputs,
            manifest->num_outputs);

        node->status = result.status;
        if (result.status == PP_ERR) {
            set_error("firmware block execution failed");
            return 0;
        }

        for (port = 0; port < manifest->num_outputs && port < 3U; port++) {
            node->outputs[port] = node_outputs[port];
        }
    }
    return 1;
}

static int parse_output_bindings(
    const char *graph_json,
    const char *graph_end,
    pp_wasm_output_binding_t *bindings,
    uint8_t *binding_count)
{
    const char *outputs_begin;
    const char *outputs_end;
    const char *p;

    *binding_count = 0;
    if (!get_object_value(graph_json, graph_end, "outputs", &outputs_begin, &outputs_end)) {
        return 1;
    }

    p = outputs_begin + 1;
    while (p < outputs_end) {
        char key[32];
        char ref[96];
        const char *after_key;
        const char *value;

        p = skip_ws(p);
        if (!p || p >= outputs_end || *p == '}') {
            break;
        }
        if (*p == ',') {
            p++;
            continue;
        }
        if (*p != '"') {
            set_error("output binding key is malformed");
            return 0;
        }
        if (*binding_count >= PP_WASM_MAX_OUTPUT_BINDINGS) {
            set_error("too many output bindings");
            return 0;
        }
        if (!read_json_string(p, outputs_end, key, sizeof(key), &after_key)) {
            set_error("output binding key is malformed");
            return 0;
        }
        value = skip_ws(after_key);
        if (!value || *value != ':') {
            set_error("output binding value is malformed");
            return 0;
        }
        value = skip_ws(value + 1);
        if (!read_json_string(value, outputs_end, ref, sizeof(ref), &p)) {
            set_error("output binding value is malformed");
            return 0;
        }
        snprintf(bindings[*binding_count].binding_name, sizeof(bindings[*binding_count].binding_name), "%s", key);
        split_ref(ref, bindings[*binding_count].node_id, sizeof(bindings[*binding_count].node_id), bindings[*binding_count].port_name, sizeof(bindings[*binding_count].port_name));
        (*binding_count)++;
    }
    return 1;
}

static int append_packet_json(char *buffer, size_t capacity, size_t *offset, const pp_packet_t *packet)
{
    uint16_t i;

    json_append(buffer, capacity, offset,
        "{\"kind\":\"%s\",\"axis\":%u,\"sample_rate_hz\":%u,\"length\":%u,\"values\":[",
        kind_name(packet->kind),
        (unsigned)packet->axis,
        (unsigned)packet->sample_rate_hz,
        (unsigned)packet->length);
    for (i = 0; i < packet->length; i++) {
        if (i > 0U) {
            json_append(buffer, capacity, offset, ",");
        }
        json_append(buffer, capacity, offset, "%d", packet->data ? (int)packet->data[i] : 0);
    }
    json_append(buffer, capacity, offset, "]}");
    return *offset < capacity;
}

static int serialize_run_result(
    const pp_graph_t *graph,
    const pp_wasm_node_t *nodes,
    const pp_wasm_output_binding_t *bindings,
    uint8_t binding_count)
{
    size_t offset = 0;
    uint8_t i;

    s_last_result_json[0] = '\0';
    json_append(s_last_result_json, sizeof(s_last_result_json), &offset, "{\"outputs\":{");

    for (i = 0; i < binding_count; i++) {
        int node_index = find_node_index(nodes, graph->node_count, bindings[i].node_id);
        const pp_block_manifest_t *manifest;
        int port_index;

        if (node_index < 0) {
            set_error("output binding references an unknown node");
            return 0;
        }
        manifest = pp_block_get_manifest(nodes[node_index].meta->block_id);
        if (!manifest) {
            set_error("output binding firmware manifest is missing");
            return 0;
        }
        port_index = port_index_by_name(nodes[node_index].meta->output_names, manifest->num_outputs, bindings[i].port_name, 0);
        if (port_index < 0 || port_index >= manifest->num_outputs) {
            set_error("output binding references an unknown port");
            return 0;
        }
        if (i > 0U) {
            json_append(s_last_result_json, sizeof(s_last_result_json), &offset, ",");
        }
        if (!json_append_string(s_last_result_json, sizeof(s_last_result_json), &offset, bindings[i].binding_name) ||
            !json_append(s_last_result_json, sizeof(s_last_result_json), &offset, ":")) {
            set_error("run result JSON exceeded buffer capacity");
            return 0;
        }
        if (!append_packet_json(s_last_result_json, sizeof(s_last_result_json), &offset, &nodes[node_index].outputs[port_index])) {
            set_error("run result JSON exceeded buffer capacity");
            return 0;
        }
    }

    json_append(s_last_result_json, sizeof(s_last_result_json), &offset, "},\"diagnostics\":{\"nodes\":[");
    for (i = 0; i < graph->node_count; i++) {
        if (i > 0U) {
            json_append(s_last_result_json, sizeof(s_last_result_json), &offset, ",");
        }
        json_append(s_last_result_json, sizeof(s_last_result_json), &offset, "{\"node_id\":");
        json_append_string(s_last_result_json, sizeof(s_last_result_json), &offset, nodes[i].node_id);
        json_append(s_last_result_json, sizeof(s_last_result_json), &offset, ",\"block_id\":");
        json_append_string(s_last_result_json, sizeof(s_last_result_json), &offset, nodes[i].meta->browser_id);
        json_append(s_last_result_json, sizeof(s_last_result_json), &offset, ",\"status\":");
        json_append_string(s_last_result_json, sizeof(s_last_result_json), &offset, status_name(nodes[i].status));
        json_append(s_last_result_json, sizeof(s_last_result_json), &offset, "}");
    }
    json_append(s_last_result_json, sizeof(s_last_result_json), &offset, "]}}");

    if (offset >= sizeof(s_last_result_json)) {
        set_error("run result JSON exceeded buffer capacity");
        return 0;
    }
    return 1;
}

int pp_wasm_run_graph_json(const char *graph_json, const char *inputs_json)
{
    const char *graph_end;
    pp_graph_t graph;
    pp_wasm_node_t nodes[PP_MAX_NODES];
    pp_wasm_sys_edge_t sys_edges[PP_WASM_MAX_SYS_EDGES];
    pp_wasm_input_t inputs[PP_WASM_MAX_INPUTS];
    pp_wasm_output_binding_t bindings[PP_WASM_MAX_OUTPUT_BINDINGS];
    uint8_t sys_edge_count = 0;
    uint8_t input_count = 0;
    uint8_t binding_count = 0;

    if (!graph_json) {
        set_error("graph JSON is null");
        return 1;
    }

    graph_end = graph_json + strlen(graph_json);
    if (!validate_schema_version(graph_json, graph_end) ||
        !parse_nodes(graph_json, graph_end, &graph, nodes) ||
        !parse_edges(graph_json, graph_end, &graph, nodes, sys_edges, &sys_edge_count) ||
        !parse_inputs(inputs_json, inputs, &input_count) ||
        !parse_output_bindings(graph_json, graph_end, bindings, &binding_count) ||
        !execute_graph(&graph, nodes, sys_edges, sys_edge_count, inputs, input_count) ||
        !serialize_run_result(&graph, nodes, bindings, binding_count)) {
        return 1;
    }
    return 0;
}

const char *pp_wasm_last_result_json(void)
{
    return s_last_result_json;
}
