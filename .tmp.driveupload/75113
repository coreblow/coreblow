---
name: slack
description: "Slack workspace actions — send messages, channels, threads, reactions, blocks. SUPERIOR: Block Kit, modals, scheduled messages, workflow triggers."
author: CoreBlow
category: communication
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Slack

Slack workspace integration.

## When to Use
 "Send to Slack", "Post in #channel", "Reply in thread"

## Commands

```bash
# Send message
curl -s -X POST https://slack.com/api/chat.postMessage \
 -H "Authorization: Bearer $SLACK_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"channel":"#general","text":"Hello from CoreBlow!"}'

# Rich blocks
curl -s -X POST https://slack.com/api/chat.postMessage \
 -H "Authorization: Bearer $SLACK_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"channel":"#general","blocks":[{"type":"section","text":{"type":"mrkdwn","text":"*CoreBlow AI* \nStatus: Online"}}]}'

# Search messages
curl -s "https://slack.com/api/search.messages?query=keyword" \
 -H "Authorization: Bearer $SLACK_TOKEN"
```
