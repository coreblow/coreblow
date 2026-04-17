---
name: obsidian
description: "Obsidian vault operations — create, search, link, tag notes. SUPERIOR: backlink graph, daily notes, template expansion, dataview queries."
author: CoreBlow
category: productivity
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Obsidian

Obsidian vault management.

## When to Use
 "Add note to Obsidian", "Search my vault", "Create daily note", "Find linked notes"

## Commands

```bash
# Find vault location
VAULT="$HOME/Documents/Obsidian"

# Create note
cat > "$VAULT/Notes/$(date +%Y-%m-%d)-meeting.md" << 'EOF'
---
tags: [meeting, weekly]
date: $(date +%Y-%m-%d)
---
# Meeting Notes
## Attendees
## Discussion
## Action Items
EOF

# Search notes
grep -rl "keyword" "$VAULT" --include="*.md"

# Daily note
cat > "$VAULT/Daily/$(date +%Y-%m-%d).md" << 'EOF'
# $(date +%A, %B %d, %Y)
## Tasks
- [ ]
## Notes
## Journal
EOF

# Find backlinks (notes that link to a specific note)
grep -rl "\[\[target-note\]\]" "$VAULT" --include="*.md"

# List all tags
grep -roh "#[a-zA-Z0-9_/-]*" "$VAULT" --include="*.md" | sort -u
```

## Guidelines
- Use `[[wikilinks]]` for internal links
- Use YAML frontmatter for metadata
- Follow daily note template for consistency
