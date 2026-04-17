---
name: weather
description: "Weather lookup — current conditions, forecasts, alerts. SUPERIOR: multi-source (wttr.in + Open-Meteo), location auto-detect, severe weather alerts, UV index."
author: CoreBlow
category: utility
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Weather

Weather conditions and forecasts.

## When to Use
 "What is the weather?", "Will it rain?", "Temperature in Jakarta"

## Commands

```bash
# One-liner
curl -s "wttr.in/Jakarta?format=%l:+%c+%t+(feels+like+%f),+%w+wind,+%h+humidity"

# 3-day forecast
curl -s "wttr.in/Jakarta"

# JSON (machine-readable)
curl -s "wttr.in/Jakarta?format=j1" | jq ".current_condition[0] | {temp_C, humidity, weatherDesc: .weatherDesc[0].value}"

# Specific day
curl -s "wttr.in/Jakarta?1"

# Moon phase
curl -s "wttr.in/Moon"
```

## Notes
- No API key needed
- Supports city names, airport codes, GPS coordinates
