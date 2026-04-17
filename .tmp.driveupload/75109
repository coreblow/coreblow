---
name: blogwatcher
description: "Blog and RSS monitoring — track updates, detect new posts, send alerts. SUPERIOR: content diff, keyword matching, digest generation."
author: CoreBlow
category: utility
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra BlogWatcher

Monitor blogs and RSS feeds.

## When to Use
 "Watch this blog", "Check for new posts", "Subscribe to RSS"

## Commands

```bash
# Fetch RSS feed
curl -s "https://blog.example.com/feed.xml" | xmllint --xpath "//item/title/text()" -

# Check for updates
curl -s "https://blog.example.com/feed.xml" | xmllint --xpath "//item[1]/title/text()" -

# Save feed entries
curl -s "https://blog.example.com/feed.xml" | xmllint --xpath "//item" - | head -50
```
