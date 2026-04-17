---
name: xurl
description: "URL utilities — expand shortened URLs, check redirects, extract metadata. SUPERIOR: Open Graph preview, safety check, archive lookup."
author: CoreBlow
category: utility
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra URL

URL expansion and metadata extraction.

## When to Use
 "Where does this link go?", "Expand this URL", "Check if URL is safe"

## Commands

```bash
# Expand shortened URL
curl -sI -o /dev/null -w "%{redirect_url}" "https://bit.ly/xyz"

# Full redirect chain
curl -sIL "https://bit.ly/xyz" 2>&1 | grep -i "location:"

# Extract Open Graph metadata
curl -s "https://example.com" | grep -oP '<meta property="og:(title|description|image)" content="\K[^"]+'

# Check HTTP status
curl -sI "https://example.com" | head -1
```
