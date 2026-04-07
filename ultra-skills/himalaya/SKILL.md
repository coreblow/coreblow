---
name: himalaya
description: "Email client via Himalaya CLI — read, send, search email (IMAP/SMTP). SUPERIOR: multi-account, attachment handling, template responses, batch operations."
author: CoreBlow
category: communication
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Email (Himalaya)

Email operations via Himalaya CLI.

## When to Use
 "Check email", "Send email to...", "Search inbox for..."

## Commands

```bash
# List recent emails
himalaya list --page-size 10

# Read email
himalaya read 42

# Send email
himalaya send --from "me@example.com" --to "you@example.com" --subject "Hello" --body "Message body"

# Search
himalaya search "from:boss subject:urgent"

# List folders
himalaya folders list

# Move to folder
himalaya move 42 Archive

# Download attachment
himalaya attachment download 42
```