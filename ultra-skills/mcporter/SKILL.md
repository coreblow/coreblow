---
name: mcporter
description: "Minecraft server management — start, stop, status, players, commands. SUPERIOR: auto backup, player analytics, resource monitoring, mod management."
author: CoreBlow
category: gaming
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Minecraft

Minecraft server management.

## When to Use
 "Start MC server", "Who's online?", "Run MC command", "Backup world"

## Commands

```bash
# Start server
cd /path/to/server && java -Xmx4G -Xms1G -jar server.jar nogui &

# Send command via RCON
mcrcon -H localhost -P 25575 -p password "list"
mcrcon -H localhost -P 25575 -p password "say Hello from CoreBlow!"

# Backup world
tar -czf "backup_$(date +%Y%m%d_%H%M).tar.gz" world/

# Check status
curl -s "https://api.mcsrvstat.us/2/localhost:25565" | jq "{online: .online, players: .players}"
```
