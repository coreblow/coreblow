---
name: sag
description: "System administration helper — disk, network, process, logs, security. SUPERIOR: one-liner diagnostics, security audit, performance tuning recommendations."
author: CoreBlow
category: utility
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra SysAdmin

System administration toolkit.

## When to Use
 "Disk space?", "What process is using CPU?", "Network connections", "Check logs"

## Commands

```bash
# Disk usage
df -h | grep -v tmpfs

# Top processes
ps aux --sort=-%mem | head -10

# Network connections
lsof -i -P -n | grep LISTEN

# System load
uptime

# Memory
free -h 2>/dev/null || vm_stat

# Tail logs
tail -50 /var/log/system.log

# Find large files
find / -type f -size +100M 2>/dev/null | head -20

# Open ports
netstat -tlnp 2>/dev/null || lsof -iTCP -sTCP:LISTEN -P

# DNS lookup
dig +short example.com
nslookup example.com
```