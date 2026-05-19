#ifndef COREBLOW_NODE_H
#define COREBLOW_NODE_H

#include <stddef.h>

typedef struct {
  const char *node_id;
  unsigned int uptime_seconds;
  unsigned int signal_quality;
} coreblow_node_heartbeat_t;

size_t coreblow_node_format_heartbeat(
  const coreblow_node_heartbeat_t *heartbeat,
  char *buffer,
  size_t buffer_size
);

#endif
