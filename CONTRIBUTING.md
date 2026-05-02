# Contributing to CoreBlow

Thank you for your interest in contributing to CoreBlow! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/coreblow.git
   cd coreblow/gateway
   npm install
   ```
3. Run the doctor check:
   ```bash
   npx tsx src/index.ts doctor
   ```

## Development

```bash
# Start the gateway in development
npx tsx src/index.ts gateway start

# Run with debug logging
LOG_LEVEL=debug npx tsx src/index.ts gateway start
```

## Code Style

- TypeScript with strict mode
- ES2022 target, ESM modules
- Use `createChildLogger('module-name')` for logging
- Keep files focused and under 200 lines when possible

## Pull Requests

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test with `npx tsx src/index.ts doctor`
4. Commit with a clear message: `feat: add new tool for X`
5. Push and open a PR

## Commit Convention

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code refactoring
- `test:` — tests
- `chore:` — maintenance

## Running Tests

```bash
# Full suite (uses auto-tuned maxWorkers)
npx vitest run --config vitest.unit.config.ts

# Single file
npx vitest run src/gateway/server.preauth-hardening.test.ts

# Watch mode (re-run on changes)
npx vitest --config vitest.unit.config.ts
```

### Worker Auto-Tuning

Worker count auto-adjusts based on available RAM via `scripts/test-planner/runtime-profile.mjs`:

| RAM | Memory Band | maxWorkers |
|-----|-------------|------------|
| < 24 GiB | `constrained` | 2 |
| 24–47 GiB | `moderate` | 3 |
| 48–95 GiB | `mid` | 4 |
| 96+ GiB | `high` | 6 |

Load-aware scaling automatically reduces workers when CPU is busy.

### Environment Overrides

```bash
# Force specific worker count
COREBLOW_VITEST_MAX_WORKERS=1 npx vitest run --config vitest.unit.config.ts

# Force memory/CPU detection
COREBLOW_TEST_HOST_MEMORY_GIB=64 npx vitest run --config vitest.unit.config.ts
COREBLOW_TEST_HOST_CPU_COUNT=16 npx vitest run --config vitest.unit.config.ts

# Profile modes: normal (default), serial (1 worker), max (boost)
COREBLOW_TEST_PROFILE=serial npx vitest run --config vitest.unit.config.ts
```

## Need Help?

Open an issue or start a discussion. We're friendly! 😊
