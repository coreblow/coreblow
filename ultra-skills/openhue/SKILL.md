---
name: openhue
description: "Philips Hue smart lights — control lights, scenes, rooms, schedules. SUPERIOR: scene presets, party mode, adaptive lighting, automation rules."
author: CoreBlow
category: iot
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Hue

Philips Hue smart light control.

## When to Use
 "Turn on lights", "Set bedroom to warm", "Movie mode", "Party lights"

## Commands

```bash
# Discover bridge
curl -s "https://discovery.meethue.com/" | jq ".[0].internalipaddress"

# List lights
curl -s "http://$HUE_BRIDGE/api/$HUE_USER/lights" | jq "keys[]"

# Turn on/off
curl -s -X PUT "http://$HUE_BRIDGE/api/$HUE_USER/lights/1/state" -d '{"on":true}'

# Set color (HSB)
curl -s -X PUT "http://$HUE_BRIDGE/api/$HUE_USER/lights/1/state" -d '{"on":true,"hue":46920,"sat":254,"bri":254}'

# Scene presets
curl -s -X PUT "http://$HUE_BRIDGE/api/$HUE_USER/groups/0/action" -d '{"scene":"SCENE_ID"}'
```

## Presets (SUPERIOR)
| Mode | Settings |
|------|----------|
| Movie | bri:80, ct:400, warm dim |
| Reading | bri:200, ct:350 |
| Party | colorloop effect |
| Sleep | bri:1, ct:500, transition:30min |
