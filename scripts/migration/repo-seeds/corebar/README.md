# CoreBar

Menu bar control plane for local-first CoreBlow apps.

## Overview

CoreBar is part of the CoreBlow public repository family. Local desktop control plane for CoreBlow companion applications.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 4
- Priority: desktop
- Kind: control-plane
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Menu bar and desktop interaction primitives.
- Local-first app coordination patterns.
- Swift package contracts for the control surface.

## Out of Scope

- Core gateway ownership.
- Cloud-hosted management surfaces.

## Key Files

- `Package.swift`
- `Sources/CoreBar/CoreBarStatus.swift`
- `Tests/CoreBarTests/CoreBarStatusTests.swift`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/pull_request_template.md`

## Development

### Test

```sh
swift test
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
