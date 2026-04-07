---
name: bluebubbles
description: "BlueBubbles iMessage bridge — REST API for iMessage on non-Mac. SUPERIOR: reactions, tapbacks, typing indicators, group management."
author: CoreBlow
category: communication
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra BlueBubbles

BlueBubbles iMessage bridge control.

## When to Use
 "Send iMessage via BlueBubbles", "Read chats", "React to message"

## Commands

```bash
# Send message
curl -s -X POST "$BLUEBUBBLES_URL/api/v1/message/text?password=$BB_PASS" \
 -H "Content-Type: application/json" \
 -d '{"chatGuid":"iMessage;-;+1234567890","message":"Hello!"}'

# Get chats
curl -s "$BLUEBUBBLES_URL/api/v1/chat?password=$BB_PASS&limit=20"

# Get messages
curl -s "$BLUEBUBBLES_URL/api/v1/chat/CHAT_GUID/message?password=$BB_PASS&limit=25"

# Send reaction
curl -s -X POST "$BLUEBUBBLES_URL/api/v1/message/react?password=$BB_PASS" \
 -H "Content-Type: application/json" \
 -d '{"chatGuid":"GUID","selectedMessageGuid":"MSG_GUID","reaction":2000}'
```