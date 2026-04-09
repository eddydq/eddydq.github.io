#ifndef PP_PACKET_H
#define PP_PACKET_H

#include <stdint.h>

#define PP_MAX_SERIES_SAMPLES 512

typedef enum pp_packet_kind_e {
    PP_PACKET_RAW_WINDOW = 1,
    PP_PACKET_SERIES = 2,
    PP_PACKET_CANDIDATE = 3,
    PP_PACKET_ESTIMATE = 4
} pp_packet_kind_t;

typedef struct pp_raw_window_s {
    float sample_rate_hz;
    float x[PP_MAX_SERIES_SAMPLES];
    float y[PP_MAX_SERIES_SAMPLES];
    float z[PP_MAX_SERIES_SAMPLES];
    uint16_t length;
} pp_raw_window_t;

typedef struct pp_series_s {
    float sample_rate_hz;
    float values[PP_MAX_SERIES_SAMPLES];
    uint16_t length;
    char axis[16];
} pp_series_t;

typedef struct pp_candidate_s {
    float sample_rate_hz;
    float spm;
    float confidence;
} pp_candidate_t;

typedef struct pp_estimate_s {
    float sample_rate_hz;
    float spm;
} pp_estimate_t;

typedef struct pp_packet_s {
    pp_packet_kind_t kind;
    union {
        pp_raw_window_t raw_window;
        pp_series_t series;
        pp_candidate_t candidate;
        pp_estimate_t estimate;
    } payload;
} pp_packet_t;

#endif
