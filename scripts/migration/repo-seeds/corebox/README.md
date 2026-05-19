# CoreBox

CoreBlow clean-room validation runner.

CoreBox is the CI infra companion for warming a clean workspace, syncing an input tree, and running a bounded command set. It is intentionally outside `coreblow/coreblow` so runner behavior can evolve independently from the product runtime.

## Scope

- Clean-room command planning.
- CI runner contract checks.
- Future remote execution adapters.

## Development

```sh
npm test
```
