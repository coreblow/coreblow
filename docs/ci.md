# CI

CoreBlow uses GitHub Actions for the public repository at `coreblow/coreblow`.

## Main Workflows

| Workflow | Purpose |
| --- | --- |
| `CI` | TypeScript checks, unit tests, e2e tests, contract tests, and lint summary. |
| `CI - Build` | Build and declaration checks. |
| `CI - Unit Tests` | Unit test lane through the repository test wrapper. |
| `Gateway CI` | Gateway-focused test lane split into three shards. |
| `CI - Lint and Type` | Lint and type-oriented checks. |
| `CI - Bun` | Bun compatibility lane. |
| `Install Smoke` | Pack and install smoke test for the CLI. |
| `Docker` | Container build lane. |
| `Security` | Security checks. |
| `Parity Check` | Reference parity audit lane. |
| `Smoke Test` | High-level runtime smoke checks. |

## Gateway CI Shards

Gateway CI runs a three-job matrix:

```bash
pnpm test:gateway
```

Each shard receives:

```bash
COREBLOW_TEST_PROFILE=serial
COREBLOW_TEST_SHARDS=3
COREBLOW_TEST_SHARD_INDEX=<1|2|3>
```

The workflow then runs the type check and declaration build gates for the gateway surface.
