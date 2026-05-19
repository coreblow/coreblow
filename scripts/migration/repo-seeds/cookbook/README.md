# CoreBlow Cookbook

Example apps and recipes for the CoreBlow SDK.

## Overview

CoreBlow Cookbook is part of the CoreBlow public repository family. Example applications and recipes for CoreBlow SDK users.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 6
- Priority: ecosystem
- Kind: examples
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Small recipes that demonstrate SDK usage.
- Runnable examples with direct tests.
- Contributor-friendly patterns for ecosystem authors.

## Out of Scope

- Reference-only examples that cannot be tested.
- Private customer recipes.

## Key Files

- `examples/hello-agent/index.mjs`
- `package.json`
- `recipes/hello-agent.md`
- `test/recipes.test.mjs`
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
