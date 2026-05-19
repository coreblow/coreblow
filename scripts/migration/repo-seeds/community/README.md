# CoreBlow Community

Policies and documentation for the CoreBlow community.

## Overview

CoreBlow Community is part of the CoreBlow public repository family. Public community operating model for CoreBlow contributors and maintainers.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 6
- Priority: governance
- Kind: community
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Contributor roles and onboarding.
- Community rules and incident response references.
- Governance documentation that should stay separate from runtime code.

## Out of Scope

- Security vulnerability intake.
- Core runtime implementation.

## Key Files

- `incident-playbook.md`
- `onboarding.md`
- `package.json`
- `roles.md`
- `rules.md`
- `scripts/check-docs.mjs`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`

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
