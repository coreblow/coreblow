# CoreBlow RTT

RTT timing measurements across CoreBlow releases.

## Overview

CoreBlow RTT is part of the CoreBlow public repository family. Round-trip timing measurement surface for CoreBlow releases.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 4
- Priority: quality
- Kind: measurement
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- RTT measurement scripts.
- Release comparison data.
- Small checks that make timing regressions visible.

## Out of Scope

- Production monitoring storage.
- Benchmark claims without reproducible data.

## Key Files

- `data/.gitkeep`
- `package.json`
- `scripts/rtt.mjs`
- `test/rtt.test.mjs`
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
