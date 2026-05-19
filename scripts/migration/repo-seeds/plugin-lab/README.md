# Plugin Lab

Compatibility testbed for CoreBlow community plugins and plugin seams.

## Overview

Plugin Lab is part of the CoreBlow public repository family. Compatibility testbed for CoreBlow community plugins.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 2
- Priority: ecosystem
- Kind: plugin-fixture
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Plugin manifest validation.
- Compatibility fixtures.
- Ecosystem test cases outside the core runtime.

## Out of Scope

- Bundled plugin source ownership.
- A public plugin registry.

## Key Files

- `fixtures/basic-plugin/coreblow.plugin.json`
- `fixtures/basic-plugin/index.js`
- `package.json`
- `src/manifest.mjs`
- `test/manifest.test.mjs`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`

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
