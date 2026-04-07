---
name: notion
description: "Notion workspace management — pages, databases, blocks, comments. SUPERIOR: batch updates, database queries, template creation, relationship management."
author: CoreBlow
category: productivity
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Notion

Full Notion workspace integration.

## When to Use
 "Add to Notion", "Search Notion", "Create page", "Query database", "Update task status"

## Commands

### Pages
```bash
# Create page
curl -s -X POST https://api.notion.com/v1/pages \
 -H "Authorization: Bearer $NOTION_TOKEN" \
 -H "Notion-Version: 2022-06-28" \
 -H "Content-Type: application/json" \
 -d '{"parent":{"database_id":"DB_ID"},"properties":{"title":{"title":[{"text":{"content":"New Page"}}]}}}'

# Search
curl -s -X POST https://api.notion.com/v1/search \
 -H "Authorization: Bearer $NOTION_TOKEN" \
 -H "Notion-Version: 2022-06-28" \
 -d '{"query":"meeting notes","filter":{"property":"object","value":"page"}}'
```

### Databases (SUPERIOR: complex queries)
```bash
# Query with filters
curl -s -X POST "https://api.notion.com/v1/databases/DB_ID/query" \
 -H "Authorization: Bearer $NOTION_TOKEN" \
 -H "Notion-Version: 2022-06-28" \
 -d '{"filter":{"property":"Status","select":{"equals":"In Progress"}},"sorts":[{"property":"Priority","direction":"descending"}]}'
```

## Guidelines
- Always use `Notion-Version: 2022-06-28` header
- Use database queries for structured data
- Batch updates for efficiency
