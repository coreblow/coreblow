# CoreBox

CoreBlow clean-room validation runner.

## Overview

CoreBox is part of the CoreBlow public repository family. Platform companion code for CoreBlow environments.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 2
- Priority: ci-infra
- Kind: runner
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Platform-specific integration files.
- Companion node contracts.
- Checks that keep the platform surface buildable.

## Out of Scope

- Core runtime releases.
- Cross-platform feature policy.

## Key Files

- `package.json`
- `src/cli.mjs`
- `src/plan.mjs`
- `test/plan.test.mjs`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

## Development

### Test

```sh
npm test
```

## Release Policy

Do not publish packages, tags, installers, or release artifacts from this repository without explicit CoreBlow release approval.

Version changes must follow the coordinated CoreBlow release plan.

## Links

- [CoreBlow](https://github.com/coreblow/coreblow)
- [Documentation](https://docs.coreblow.com)
- [Website](https://coreblow.com)
- [Security Policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
