---
name: github
description: "GitHub power tools — repos, PRs, issues, actions, releases, code search, org management, GitHub API v4 GraphQL. SUPERIOR: batch operations, auto-PR descriptions, release notes generation."
author: CoreBlow
category: development
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra GitHub

Full GitHub integration via `gh` CLI and API.

## When to Use

 "Create a PR", "List open issues", "Check CI status", "Create a release", "Search code on GitHub"

 Local git operations only → use git directly

## Commands

### Repository
```bash
# Clone repo
gh repo clone owner/repo

# Create repo
gh repo create my-app --public --description "My app"

# View repo info
gh repo view owner/repo --json name,description,stargazerCount,forkCount

# List repos
gh repo list owner --limit 50 --json name,isPrivate,stargazerCount --jq '.[] | "\(.name) \(.stargazerCount)"'
```

### Pull Requests (SUPERIOR: auto-description)
```bash
# Create PR with auto-generated description from commits
gh pr create --title "feat: add user auth" --body "$(git log --oneline main..HEAD | sed 's/^/- /')"

# List PRs
gh pr list --state open --json number,title,author --jq '.[] | "#\(.number) \(.title) by @\(.author.login)"'

# Review PR
gh pr review 42 --approve --body "LGTM! "

# Merge PR
gh pr merge 42 --squash --delete-branch

# Check PR status (CI/checks)
gh pr checks 42
```

### Issues (SUPERIOR: batch operations)
```bash
# Create issue
gh issue create --title "Bug: crash on login" --body "Steps to reproduce..." --label bug

# List issues
gh issue list --state open --label "bug" --json number,title,assignees

# Close multiple issues (batch)
for i in 10 11 12; do gh issue close $i --comment "Fixed in PR #42"; done

# Search issues
gh search issues "memory leak" --repo owner/repo --json number,title
```

### Actions & CI
```bash
# List workflow runs
gh run list --limit 10 --json status,conclusion,name

# View run details
gh run view 12345 --log-failed

# Re-run failed
gh run rerun 12345 --failed

# Watch run in real-time
gh run watch 12345
```

### Releases (SUPERIOR: auto release notes)
```bash
# Create release with auto-generated notes
gh release create v1.2.0 --generate-notes --title "v1.2.0"

# Create release with specific files
gh release create v1.2.0 ./dist/*.zip --notes "## Changes\n- Feature A\n- Fix B"

# List releases
gh release list --limit 5
```

### Code Search (SUPERIOR: GraphQL)
```bash
# Search code across GitHub
gh search code "createServer" --language typescript --repo owner/repo

# GraphQL query for advanced data
gh api graphql -f query='{ repository(owner:"owner",name:"repo") { stargazerCount forkCount issues(states:OPEN) { totalCount } } }'
```

## Guidelines

- Always use `--json` flag for machine-readable output
- Use `--jq` for filtering JSON results
- Prefer `--squash` merge for clean history
- Auto-generate PR descriptions from commit messages
