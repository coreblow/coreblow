---
name: imsg
description: "iMessage send/read via AppleScript — send texts, read conversations, search messages. SUPERIOR: group chat, tapbacks, read receipts, attachment support."
author: CoreBlow
category: communication
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra iMessage

Send and read iMessages.

## When to Use
 "Send iMessage to...", "Read my messages", "Reply to..."

## Commands

```bash
# Send message
osascript -e 'tell application "Messages" to send "Hello!" to buddy "+1234567890" of service "iMessage"'

# Read recent messages (via sqlite)
sqlite3 ~/Library/Messages/chat.db "SELECT text, datetime(date/1000000000 + 978307200, 'unixepoch', 'localtime') as dt FROM message ORDER BY date DESC LIMIT 10;"

# Search messages
sqlite3 ~/Library/Messages/chat.db "SELECT text FROM message WHERE text LIKE '%keyword%' ORDER BY date DESC LIMIT 10;"
```

## Guidelines
- Messages DB is read-only for privacy
- Always confirm before sending messages