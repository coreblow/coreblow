---
name: coreblow-false-gap-audit
description: Audit CoreBlow Phase 4 parity gaps that may already be implemented under different names or architecture.
---

# CoreBlow False Gap Audit

Use this skill when a file appears in the parity gap matrix but may already exist in CoreBlow with different naming, consolidated types, or OOP architecture.

## Workflow

For each candidate:

1. Read the upstream OpenClaw file.
2. Search CoreBlow for exact filename.
3. Search CoreBlow for exported symbols.
4. Search CoreBlow for equivalent behavior.
5. Classify as:
   - `true gap`
   - `false gap`
   - `mixed merge`
   - `blocked`

Use `rg` for symbol searches.

## Evidence To Capture

Report:

- upstream file path and line count
- CoreBlow equivalent path, if any
- matching symbols or behavior
- reason for classification
- whether source changes are needed

## Rules

- Do not edit while auditing unless explicitly asked.
- Do not create duplicate wrappers just to satisfy filename parity.
- Prefer CoreBlow-native architecture over blind file-name matching.
- If behavior exists in a consolidated type file or class, classify as false gap.

## Final Output

Provide a compact table:

```text
file | classification | evidence | next action
```
