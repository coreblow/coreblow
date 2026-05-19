# CoreHub

Skill and plugin directory for CoreBlow.

## Overview

CoreHub is part of the CoreBlow public repository family. Public directory for CoreBlow skills, plugins, and ecosystem metadata.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 2
- Priority: ecosystem
- Kind: directory
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Catalog entries.
- Directory validation.
- Compatibility metadata for CoreBlow releases.

## Out of Scope

- Bundled plugin source code.
- A package registry mirror.
- A replacement for `coreblow/coreblow` `extensions/*`.

## Key Files

- `catalog.json`
- `package.json`
- `src/catalog.mjs`
- `test/catalog.test.mjs`
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
