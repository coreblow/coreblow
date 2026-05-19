# ESP CoreBlow Node

ESP CoreBlow node.

## Overview

ESP CoreBlow Node is part of the CoreBlow public repository family. Embedded node companion for CoreBlow environments.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 5
- Priority: platform
- Kind: embedded
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Embedded node contracts.
- Device-facing examples.
- Hardware-adjacent integration notes.

## Out of Scope

- Core runtime releases.
- Device secrets or production credentials.

## Key Files

- `components/coreblow_node/coreblow_node.c`
- `examples/heartbeat/main.c`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`

## Development

This seed does not define an automated development gate yet. Add one before expanding the repository surface.

## Release Policy

Do not publish packages, tags, installers, or release artifacts from this repository without explicit CoreBlow release approval.

Version changes must follow the coordinated CoreBlow release plan.

## Links

- [CoreBlow](https://github.com/coreblow/coreblow)
- [Documentation](https://docs.coreblow.com)
- [Website](https://coreblow.com)
- [Security Policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
