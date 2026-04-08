#include <stdio.h>

#include "pp_runtime.h"

int main(void) {
    pp_node_t nodes[] = {
        { "n1", "test.inline", "{}" },
        { "n2", "test.inline", "{}" }
    };
    pp_connection_t ok_connections[] = {
        { "input.raw", "n1.source" },
        { "n1.primary", "n2.source" }
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
        { "final", "n2.primary" }
    };
    pp_output_binding_t bad_outputs[] = {
        { "final", "ghost.primary" }
    };
    pp_node_t duplicate_nodes[] = {
        { "n1", "test.inline", "{}" },
        { "n1", "test.inline", "{}" }
    };
    pp_graph_t ok_graph = { 2, nodes, 2, ok_connections, 2, outputs, 1 };
    pp_graph_t cycle_graph = { 2, nodes, 2, cycle_connections, 2, outputs, 1 };
    pp_graph_t bad_source_graph = { 2, nodes, 2, bad_source_connections, 1, outputs, 1 };
    pp_graph_t bad_output_graph = { 2, nodes, 2, ok_connections, 2, bad_outputs, 1 };
    pp_graph_t duplicate_node_graph = { 2, duplicate_nodes, 2, ok_connections, 2, outputs, 1 };
    pp_graph_t portless_graph = { 2, nodes, 2, portless_connections, 1, outputs, 1 };
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

    input_packets[0].binding_name = "raw";
    input_packets[0].packet.kind = PP_PACKET_RAW_WINDOW;
    unnamed_input_packets[0].binding_name = "";
    unnamed_input_packets[0].packet.kind = PP_PACKET_RAW_WINDOW;

    pp_runtime_result_t run_result = pp_runtime_run(&ok_graph, input_packets, 1, output_packets, 4, &output_count);
    pp_runtime_result_t unnamed_input_result = pp_runtime_run(&ok_graph, unnamed_input_packets, 1, output_packets, 4, &output_count);

    printf("{\"validate_ok\":%s,\"cycle_detected\":%s,\"state_ok\":%s}\n",
        ok_validate.status == PP_RUNTIME_OK &&
        bad_source_validate.status == PP_RUNTIME_INVALID_GRAPH &&
        bad_output_validate.status == PP_RUNTIME_INVALID_GRAPH &&
        duplicate_node_validate.status == PP_RUNTIME_INVALID_GRAPH &&
        portless_validate.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false",
        cycle_validate.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false",
        run_result.status == PP_RUNTIME_OK &&
        output_count == 0 &&
        unnamed_input_result.status == PP_RUNTIME_INVALID_GRAPH ? "true" : "false");
    return 0;
}
