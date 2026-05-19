# Nix CoreBlow Tools

Nix tools for CoreBlow.

## Overview

Nix CoreBlow Tools is part of the CoreBlow public repository family. Nix helper tools for CoreBlow development and operations.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 5
- Priority: distribution
- Kind: nix-tools
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Tooling flakes.
- Developer environment helpers.
- Nix-specific validation surfaces.

## Out of Scope

- Core runtime source ownership.
- Non-Nix package manager metadata.

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
