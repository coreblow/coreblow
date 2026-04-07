---
name: bear-notes
description: "Bear app notes — rich markdown, tags, wiki links. SUPERIOR: tag tree, export, cross-linking."
author: CoreBlow
category: productivity
user-invocable: true
---

# Ultra Bear Notes

Bear app integration via x-callback-url.

## When to Use
 "Save to Bear", "Search Bear notes", "Tag this note"

## Commands

```bash
# Create note
open 'bear://x-callback-url/create?title=My%20Note&text=Note%20content&tags=work,important'

# Search
open 'bear://x-callback-url/search?term=meeting%20notes'

# Open specific note
open 'bear://x-callback-url/open-note?title=My%20Note'
```
