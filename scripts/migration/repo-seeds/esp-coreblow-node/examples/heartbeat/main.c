#include "coreblow_node.h"

#include <stdio.h>

int main(void) {
  char buffer[128];
  coreblow_node_heartbeat_t heartbeat = {
    .node_id = "esp-coreblow-node",
    .uptime_seconds = 42,
    .signal_quality = 100,
  };
  coreblow_node_format_heartbeat(&heartbeat, buffer, sizeof(buffer));
  puts(buffer);
  return 0;
}
