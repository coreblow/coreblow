# CoreKit

Shared CoreBlow local-first toolkit.

CoreKit holds small reusable building blocks for CoreBlow companion apps and services. It follows the OpenClaw `crawlkit` split pattern while keeping CoreBlow's naming and enterprise-oriented boundaries.

## Scope

- Normalize local endpoint descriptors.
- Keep shared client helpers independent from the core runtime.
- Provide stable primitives for app, desktop, and automation repos.

## Development

```sh
go test ./...
```
