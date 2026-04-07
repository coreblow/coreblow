---
name: healthcheck
description: "Service health monitoring — check endpoints, SSL certs, latency, uptime. SUPERIOR: multi-endpoint, SSL expiry warnings, historical tracking."
author: CoreBlow
category: utility
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra HealthCheck

Service monitoring and health checks.

## When to Use
 "Is my site up?", "Check API health", "SSL certificate expiry"

## Commands

```bash
# HTTP check
curl -sI -o /dev/null -w "Status: %{http_code}\nTime: %{time_total}s\nSize: %{size_download}B\n" "https://example.com"

# SSL certificate check
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates

# DNS lookup
dig +short example.com

# Port check
nc -zv example.com 443 2>&1

# Multiple endpoints
for url in "https://api.example.com/health" "https://web.example.com"; do
 echo "$url: $(curl -sI -o /dev/null -w %{http_code}