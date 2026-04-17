---
name: discord
description: "Discord bot actions — send messages, manage channels, reactions, embeds. SUPERIOR: slash commands, buttons, modals, scheduled messages."
author: CoreBlow
category: communication
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Discord

Discord operations via webhook and bot API.

## When to Use
 "Send to Discord", "Post announcement", "Check Discord messages"

## Commands

```bash
# Send via webhook
curl -s -X POST "$DISCORD_WEBHOOK_URL" \
 -H "Content-Type: application/json" \
 -d '{"content":"Hello from CoreBlow!","embeds":[{"title":"Status","color":5814783,"fields":[{"name":"Status","value":" Online"}]}]}'

# Bot API: send message
curl -s -X POST "https://discord.com/api/v10/channels/CHANNEL_ID/messages" \
 -H "Authorization: Bot $DISCORD_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"content":"Hello!"}'
```
