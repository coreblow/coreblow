---
name: 1password
description: "1Password vault lookup — search credentials securely (read-only). SUPERIOR: item types, field access, SSH key agent, service accounts."
author: CoreBlow
category: security
user-invocable: true
---

# Ultra 1Password

Secure credential lookup via 1Password CLI.

## When to Use
 "Get password for...", "Find login for...", "SSH key for..."
 Store new passwords → do manually | Share passwords → use 1Password app

## Commands

```bash
# Sign in
eval $(op signin)

# Search items
op item list --tags development --format json | jq '.[].title'

# Get specific field
op item get "GitHub" --fields username,password

# Get TOTP code
op item get "GitHub" --otp

# List SSH keys
op item list --categories "SSH Key"

# Get SSH public key
op item get "server-key" --fields "public key"
```

## Guidelines
- NEVER log or echo passwords in plaintext
- Use \`--format json\` for machine-readable output
- Prefer \`op read\` for single fields in scripts
- Items are READ-ONLY through this skill
