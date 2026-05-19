# CoreGrit Reports

Performance reports for CoreBlow.

## Overview

CoreGrit Reports is part of the CoreBlow public repository family. Public quality and performance report storage for CoreBlow.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 3
- Priority: quality
- Kind: reports
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Report indexes.
- Report validation.
- Release-adjacent quality evidence.

## Out of Scope

- Mutable production telemetry.
- Unreviewed benchmark claims.

## Key Files

- `package.json`
- `reports/index.json`
- `test/reports.test.mjs`
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
