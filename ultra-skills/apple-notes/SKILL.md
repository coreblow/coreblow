---
name: apple-notes
description: "macOS Apple Notes — create, search, list notes. SUPERIOR: folder management, rich text, shared notes."
author: CoreBlow
category: productivity
user-invocable: true
---

# Ultra Apple Notes

macOS Notes app integration.

## When to Use
 "Save this to Notes", "Search my notes", "Create a note"

## Commands

```bash
# Create note
osascript -e 'tell application "Notes" to make new note at folder "Notes" with properties {name:"Title", body:"Content"}'

# List notes
osascript -e 'tell application "Notes" to get name of every note in folder "Notes"'

# Search notes
osascript -e 'tell application "Notes" to get name of notes whose body contains "search term"'

# Count notes
osascript -e 'tell application "Notes" to count notes'
```
