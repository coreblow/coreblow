---
name: blucli
description: "Bluetooth device control — scan, pair, connect, manage devices. SUPERIOR: auto-pair, battery check, audio routing, multi-device."
author: CoreBlow
category: iot
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Bluetooth

Bluetooth device management.

## When to Use
 "Connect AirPods", "List Bluetooth devices", "Check battery"

## Commands (macOS)

```bash
# List paired devices
system_profiler SPBluetoothDataType

# Toggle Bluetooth (via blueutil)
blueutil --power 1 # on
blueutil --power 0 # off

# List devices
blueutil --paired

# Connect device
blueutil --connect AA-BB-CC-DD-EE-FF

# Disconnect
blueutil --disconnect AA-BB-CC-DD-EE-FF

# Check if connected
blueutil --is-connected AA-BB-CC-DD-EE-FF
```
