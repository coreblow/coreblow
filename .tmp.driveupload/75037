---
name: gh-issues
description: "GitHub Issues specialist — advanced search, triage, bulk operations, label management, milestone tracking. SUPERIOR: auto-categorize, smart assignment, duplicate detection."
author: CoreBlow
category: development
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra GitHub Issues

Specialized GitHub Issues management.

## When to Use

 "List bugs", "Triage issues", "Find duplicates", "Create milestone", "Bulk label"

## Commands

### Search & Filter
```bash
# Advanced search
gh search issues "crash" --repo owner/repo --state open --json number,title,labels,assignees

# Filter by label + assignee
gh issue list --label "bug,high-priority" --assignee "@me" --json number,title

# Stale issues (no activity 30+ days)
gh issue list --state open --json number,title,updatedAt --jq '.[] | select(.updatedAt < (now - 2592000 | todate))'
```

### Triage (SUPERIOR: auto-categorize)
```bash
# Auto-label based on title keywords
gh issue list --state open --json number,title --jq '.[] | select(.title | test("crash|error|fail"; "i")) | .number' | xargs -I{} gh issue edit {} --add-label "bug"

# Assign to team members round-robin
gh issue list --state open --no-assignee --json number --jq '.[].number' | while read n; do gh issue edit $n --add-assignee "dev$(( n % 3 + 1 ))"; done
```

### Bulk Operations
```bash
# Close all stale issues
gh issue list --state open --label "wontfix" --json number --jq '.[].number' | xargs -I{} gh issue close {} --comment "Closing as won't fix."

# Add label to multiple issues
echo "1 5 10 15" | tr ' ' '\n' | xargs -I{} gh issue edit {} --add-label "v2.0"
```

### Milestones
```bash
# Create milestone
gh api repos/owner/repo/milestones -f title="v2.0" -f due_on="2025-06-01T00:00:00Z"

# List milestone progress
gh api repos/owner/repo/milestones --jq '.[] | "\(.title): \(.closed_issues)/\(.open_issues + .closed_issues) done"'
```

## Guidelines

- Always check for duplicates before creating new issues
- Use labels consistently: `bug`, `feature`, `enhancement`, `docs`
- Set milestones for release planning
