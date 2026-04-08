#include <stdio.h>
#include <string.h>

#include "pp_runtime.h"

static void fill_demo_input(pp_runtime_input_packet_t *input_packet) {
    size_t i;

    input_packet->binding_name = "raw";
    input_packet->packet.kind = PP_PACKET_RAW_WINDOW;
    input_packet->packet.payload.raw_window.sample_rate_hz = 52.0f;
    input_packet->packet.payload.raw_window.length = 64;
    for (i = 0; i < 64; i += 1) {
        input_packet->packet.payload.raw_window.x[i] = 0.0f;
        input_packet->packet.payload.raw_window.y[i] = (i % 26) < 13 ? 1.0f : -1.0f;
        input_packet->packet.payload.raw_window.z[i] = 0.0f;
    }
}

static void fill_candidate_input(pp_runtime_input_packet_t *input_packet, float spm) {
    input_packet->binding_name = "candidate";
    input_packet->packet.kind = PP_PACKET_CANDIDATE;
    input_packet->packet.payload.candidate.sample_rate_hz = 52.0f;
    input_packet->packet.payload.candidate.spm = spm;
    input_packet->packet.payload.candidate.confidence = 1.0f;
}

static void write_vertical_slice_json(void) {
    pp_node_t nodes[] = {
        { "n1", "representation.select_axis", "{\"axis\":\"y\"}" },
        { "n2", "estimation.autocorrelation", "{\"min_lag_samples\":10,\"max_lag_samples\":80}" },
        { "n3", "validation.spm_range_gate", "{\"min_spm\":20.0,\"max_spm\":120.0}" },
        { "n4", "suivi.kalman_2d", "{\"process_noise\":1.0,\"measurement_noise\":10.0}" }
    };
    pp_connection_t connections[] = {
        { "input.raw", "n1.source" },
        { "n1.primary", "n2.source" },
        { "n2.primary", "n3.source" },
        { "n3.accepted", "n4.source" }
    };
    pp_output_binding_t outputs[] = {
        { "final", "n4.primary" }
    };
    pp_graph_t graph = { 2, nodes, 4, connections, 4, outputs, 1 };
    pp_runtime_input_packet_t input_packets[1] = {0};
    pp_runtime_output_packet_t output_packets[4] = {0};
    size_t output_count = 0;
    pp_runtime_result_t result;

    fill_demo_input(&input_packets[0]);
    result = pp_runtime_run(&graph, input_packets, 1, output_packets, 4, &output_count);
    if (result.status != PP_RUNTIME_OK || output_count == 0) {
        printf("{\"error\":\"%s\"}\n", result.message);
        return;
    }

    printf(
        "{\"outputs\":{\"final\":[{\"kind\":\"estimate\",\"data\":{\"spm\":%.6f}}]},\"diagnostics\":{\"engine\":\"runtime-node\"}}\n",
        output_packets[0].packet.payload.estimate.spm
    );
}

int main(int argc, char **argv) {
    if (argc > 1 && strcmp(argv[1], "vertical-slice") == 0) {
        write_vertical_slice_json();
        return 0;
    }

    {
        pp_node_t nodes[] = {
            { "n1", "representation.select_axis", "{\"axis\":\"y\"}" },
            { "n2", "estimation.autocorrelation", "{\"min_lag_samples\":10,\"max_lag_samples\":80}" },
            { "n3", "validation.spm_range_gate", "{\"min_spm\":20.0,\"max_spm\":120.0}" },
            { "n4", "suivi.kalman_2d", "{\"process_noise\":1.0,\"measurement_noise\":10.0}" }
        };
        pp_connection_t ok_connections[] = {
            { "input.raw", "n1.source" },
            { "n1.primary", "n2.source" },
            { "n2.primary", "n3.source" },
            { "n3.accepted", "n4.source" }
        };
        pp_connection_t cycle_connections[] = {
            { "n1.primary", "n2.source" },
            { "n2.primary", "n1.source" }
        };
        pp_connection_t bad_source_connections[] = {
            { "ghost.primary", "n2.source" }
        };
        pp_connection_t portless_connections[] = {
            { "input.raw", "n1." }
        };
        pp_output_binding_t outputs[] = {
            { "final", "n4.primary" }
        };
        pp_output_binding_t bad_outputs[] = {
            { "final", "ghost.primary" }
        };
        pp_node_t duplicate_nodes[] = {
            { "n1", "representation.select_axis", "{\"axis\":\"y\"}" },
            { "n1", "estimation.autocorrelation", "{\"min_lag_samples\":10,\"max_lag_samples\":80}" }
        };
        pp_graph_t ok_graph = { 2, nodes, 4, ok_connections, 4, outputs, 1 };
        pp_graph_t cycle_graph = { 2, nodes, 2, cycle_connections, 2, outputs, 1 };
        pp_graph_t bad_source_graph = { 2, nodes, 4, bad_source_connections, 1, outputs, 1 };
        pp_graph_t bad_output_graph = { 2, nodes, 4, ok_connections, 4, bad_outputs, 1 };
        pp_graph_t duplicate_node_graph = { 2, duplicate_nodes, 2, ok_connections, 4, outputs, 1 };
        pp_graph_t portless_graph = { 2, nodes, 4, portless_connections, 1, outputs, 1 };
        pp_runtime_input_packet_t input_packets[1] = {0};
        pp_runtime_input_packet_t unnamed_input_packets[1] = {0};
        size_t order[8] = {0};
        pp_runtime_result_t ok_validate = pp_graph_validate(&ok_graph);
        pp_runtime_result_t bad_source_validate = pp_graph_validate(&bad_source_graph);
        pp_runtime_result_t bad_output_validate = pp_graph_validate(&bad_output_graph);
        pp_runtime_result_t duplicate_node_validate = pp_graph_validate(&duplicate_node_graph);
        pp_runtime_result_t portless_validate = pp_graph_validate(&portless_graph);
        pp_runtime_result_t cycle_validate = pp_graph_build_schedule(&cycle_graph, order, 8);
        pp_runtime_output_packet_t output_packets[4] = {0};
        size_t output_count = 0;
        pp_runtime_result_t run_result;
        pp_runtime_result_t unnamed_input_result;
        pp_node_t stateful_nodes[] = {
            { "k1", "suivi.kalman_2d", "{\"process_noise\":1.0,\"measurement_noise\":10.0}" }
        };
        pp_connection_t stateful_connections[] = {
            { "input.candidate", "k1.source" }
        };
        pp_output_binding_t stateful_outputs[] = {
            { "final", "k1.primary" }
        };
        pp_graph_t stateful_graph = { 2, stateful_nodes, 1, stateful_connections, 1, stateful_outputs, 1 };
        pp_runtime_input_packet_t candidate_inputs[1] = {0};
        pp_runtime_output_packet_t stateful_output_packets[1] = {0};
        size_t stateful_output_count = 0;
        float first_stateful_spm = 0.0f;
        float second_stateful_spm = 0.0f;
        pp_node_t port_error_nodes[] = {
            { "k1", "suivi.kalman_2d", "{\"process_noise\":1.0,\"measurement_noise\":10.0}" }
        };
        pp_connection_t port_error_connections[] = {
            { "input.candidate", "k1.not_a_real_port" }
        };
        pp_graph_t port_error_graph = { 2, port_error_nodes, 1, port_error_connections, 1, stateful_outputs, 1 };
        pp_connection_t kind_error_connections[] = {
            { "input.raw", "k1.source" }
        };
        pp_graph_t kind_error_graph = { 2, port_error_nodes, 1, kind_error_connections, 1, stateful_outputs, 1 };
        pp_output_binding_t overflow_outputs[] = {
            { "first", "n4.primary" },
            { "second", "n4.primary" }
        };
        pp_graph_t overflow_graph = { 2, nodes, 4, ok_connections, 4, overflow_outputs, 2 };
        pp_runtime_result_t port_error_result;
        pp_runtime_result_t kind_error_result;
        pp_runtime_result_t overflow_result;

        fill_demo_input(&input_packets[0]);
        unnamed_input_packets[0].binding_name = "";
        unnamed_input_packets[0].packet.kind = PP_PACKET_RAW_WINDOW;
        run_result = pp_runtime_run(&ok_graph, input_packets, 1, output_packets, 4, &output_count);
        unnamed_input_result = pp_runtime_run(&ok_graph, unnamed_input_packets, 1, output_packets, 4, &output_count);
        fill_candidate_input(&candidate_inputs[0], 60.0f);
        if (pp_runtime_run(&stateful_graph, candidate_inputs, 1, stateful_output_packets, 1, &stateful_output_count).status == PP_RUNTIME_OK &&
            stateful_output_count == 1) {
            first_stateful_spm = stateful_output_packets[0].packet.payload.estimate.spm;
        }
        fill_candidate_input(&candidate_inputs[0], 90.0f);
        if (pp_runtime_run(&stateful_graph, candidate_inputs, 1, stateful_output_packets, 1, &stateful_output_count).status == PP_RUNTIME_OK &&
            stateful_output_count == 1) {
            second_stateful_spm = stateful_output_packets[0].packet.payload.estimate.spm;
        }
        port_error_result = pp_runtime_run(&port_error_graph, candidate_inputs, 1, stateful_output_packets, 1, &stateful_output_count);
        kind_error_result = pp_runtime_run(&kind_error_graph, input_packets, 1, stateful_output_packets, 1, &stateful_output_count);
        overflow_result = pp_runtime_run(&overflow_graph, input_packets, 1, output_packets, 1, &output_count);

        printf("{\"validate_ok\":%s,\"cycle_detected\":%s,\"state_ok\":%s}\n",
            ok_validate.status == PP_RUNTIME_OK &&
            bad_source_validate.status == PP_RUNTIME_INVALID_GRAPH &&
            bad_output_validate.status == PP_RUNTIME_INVALID_GRAPH &&
            duplicate_node_validate.status == PP_RUNTIME_INVALID_GRAPH &&
            portless_validate.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false",
            cycle_validate.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false",
            run_result.status == PP_RUNTIME_OK &&
            output_count == 1 &&
            output_packets[0].packet.kind == PP_PACKET_ESTIMATE &&
            first_stateful_spm == 60.0f &&
            second_stateful_spm > 60.0f &&
            second_stateful_spm < 90.0f &&
            port_error_result.status == PP_RUNTIME_INVALID_GRAPH &&
            kind_error_result.status == PP_RUNTIME_PACKET_MISMATCH &&
            overflow_result.status == PP_RUNTIME_INTERNAL_ERROR &&
            unnamed_input_result.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false");
    }

    return 0;
}
