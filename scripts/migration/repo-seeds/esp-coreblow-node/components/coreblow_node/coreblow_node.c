#include "coreblow_node.h"

#include <stdio.h>

size_t coreblow_node_format_heartbeat(
  const coreblow_node_heartbeat_t *heartbeat,
  char *buffer,
  size_t buffer_size
) {
  if (heartbeat == NULL || buffer == NULL || buffer_size == 0) {
    return 0;
  }

  int written = snprintf(
    buffer,
    buffer_size,
    "{\"nodeId\":\"%s\",\"uptimeSeconds\":%u,\"signalQuality\":%u}",
    heartbeat->node_id == NULL ? "unknown" : heartbeat->node_id,
    heartbeat->uptime_seconds,
    heartbeat->signal_quality
  );

  if (written < 0) {
    return 0;
  }

  return (size_t)written >= buffer_size ? buffer_size - 1 : (size_t)written;
}
