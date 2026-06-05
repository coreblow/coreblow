# Workflow Shell

CoreBlow-native typed workflow shell.

## Overview

Workflow Shell is part of the CoreBlow public repository family. It provides the typed workflow runtime surface for CoreBlow environments.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 4
- Priority: workflow
- Kind: workflow-shell
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Typed workflow definitions.
- Local workflow execution helpers.
- Checks that keep the workflow surface buildable.

## Out of Scope

- Core runtime releases.
- Cross-platform feature policy.

## Key Files

- `package.json`
- `src/cli.mjs`
- `src/workflow.mjs`
- `test/workflow.test.mjs`
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
