---
name: trello
description: "Trello board management — cards, lists, labels, checklists. SUPERIOR: batch card operations, power-up integration, burndown tracking."
author: CoreBlow
category: productivity
user-invocable: true
---

# Ultra Trello

Trello board & card management.

## When to Use
 "Add card to Trello", "Move card", "List my tasks", "Create board"

## Commands

```bash
# List boards
curl -s "https://api.trello.com/1/members/me/boards?key=$TRELLO_KEY&token=$TRELLO_TOKEN" | jq '.[].name'

# Create card
curl -s -X POST "https://api.trello.com/1/cards?key=$TRELLO_KEY&token=$TRELLO_TOKEN" -d 'idList=LIST_ID&name=New Task&desc=Task description'

# Move card to list
curl -s -X PUT "https://api.trello.com/1/cards/CARD_ID?key=$TRELLO_KEY&token=$TRELLO_TOKEN" -d 'idList=NEW_LIST_ID'
```
