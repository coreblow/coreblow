# CoreWatch State

State storage for CoreBlow triage automation.

## Overview

CoreWatch State is part of the CoreBlow public repository family. State storage for CoreBlow maintenance and triage automation.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 3
- Priority: maintenance
- Kind: state
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Small state indexes.
- Validation for automation state shape.
- Auditable storage contracts.

## Out of Scope

- Runtime application state.
- Private issue or security data.

## Key Files

- `package.json`
- `state/index.json`
- `test/state.test.mjs`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/pull_request_template.md`

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
