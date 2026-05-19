# Nix CoreBlow

Nix packaging for CoreBlow.

## Overview

Nix CoreBlow is part of the CoreBlow public repository family. Nix packaging for CoreBlow.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 5
- Priority: distribution
- Kind: nix
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Nix flake definitions.
- Package reproducibility checks.
- Installer integration for Nix-based operators.

## Out of Scope

- Release version changes without approval.
- Non-Nix installer behavior.

## Key Files

- `flake.nix`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md`

## Development

### Check

```sh
nix flake check
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
