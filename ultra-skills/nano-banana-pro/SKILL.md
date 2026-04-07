---
name: nano-banana-pro
description: "Banana Pi / SBC hardware control — GPIO, sensors, system monitoring. SUPERIOR: pin mapping, sensor dashboards, remote control."
author: CoreBlow
category: iot
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra SBC Control

Single Board Computer (Banana Pi, Raspberry Pi) management.

## When to Use
 "Read sensor", "Toggle GPIO pin", "Check system temp", "LED control"

## Commands

```bash
# System info
cat /proc/cpuinfo | head -10
cat /proc/meminfo | head -5
vcgencmd measure_temp 2>/dev/null || cat /sys/class/thermal/thermal_zone0/temp

# GPIO (via sysfs)
echo 17 > /sys/class/gpio/export
echo out > /sys/class/gpio/gpio17/direction
echo 1 > /sys/class/gpio/gpio17/value
```