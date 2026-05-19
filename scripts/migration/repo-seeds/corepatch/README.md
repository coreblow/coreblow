# CorePatch

Review code, patch bugs, and land CoreBlow maintenance PRs.

## Overview

CorePatch is part of the CoreBlow public repository family. Maintenance automation for reviewing, planning, and landing focused CoreBlow fixes.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 3
- Priority: maintenance
- Kind: automation
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Patch planning primitives.
- Repository maintenance workflows.
- Small automation contracts that can be tested outside the core runtime.

## Out of Scope

- Release publishing.
- Direct changes to the CoreBlow runtime.

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
