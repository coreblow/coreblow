# ESP CoreBlow Node

ESP CoreBlow node.

This repository is the embedded platform surface for CoreBlow nodes. It keeps
device-specific heartbeat, identity, and telemetry helpers separate from the
core TypeScript runtime.

## Development

```sh
cc -std=c11 -Wall -Wextra -Werror -Icomponents/coreblow_node/include \
  examples/heartbeat/main.c components/coreblow_node/coreblow_node.c -o /tmp/coreblow-heartbeat
```
