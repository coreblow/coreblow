# CorePatch

Review code, patch bugs, and land CoreBlow maintenance PRs.

CorePatch is the CoreBlow maintenance automation surface. It is separate from the core runtime so patch planning, review workflows, and issue repair heuristics can evolve without adding operational coupling to `coreblow/coreblow`.

## Scope

- Build scoped patch plans.
- Classify repository maintenance work.
- Keep patch runs auditable and bounded.
- Integrate with CoreBlow CI lanes as a consumer, not as core runtime code.

## Development

```sh
npm test
```
