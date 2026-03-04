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

## Need Help?

Open an issue or start a discussion. We're friendly! 😊
