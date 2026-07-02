---
name: coreblow-false-gap-audit
description: Use when CoreBlow Phase 4 parity files appear missing but may already exist under a different CoreBlow name, consolidated type file, or OOP architecture.
---

# CoreBlow False Gap Audit

Use this skill to classify parity candidates before editing.

## Workflow

For each candidate:

1. Read the upstream OpenClaw file.
2. Search CoreBlow for the exact filename.
3. Search CoreBlow for exported symbols.
4. Search CoreBlow for equivalent behavior.
5. Classify as:
   - `true gap`
   - `false gap`
   - `mixed merge`
   - `blocked`

Use `rg` for symbol searches.

## Evidence

Report:

- upstream file path and line count
- CoreBlow equivalent path, if any
- matching symbols or behavior
- classification reason
- whether source changes are needed

Do not edit while auditing unless explicitly asked.
