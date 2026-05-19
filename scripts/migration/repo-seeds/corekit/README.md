# CoreKit

Shared CoreBlow local-first toolkit.

## Overview

CoreKit is part of the CoreBlow public repository family. Shared local-first toolkit for CoreBlow applications.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 4
- Priority: sdk
- Kind: library
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Reusable library primitives.
- Small API contracts for companion apps.
- Tests that protect SDK-facing behavior.

## Out of Scope

- Application-specific UI.
- Core runtime process ownership.

## Key Files

- `corekit_test.go`
- `corekit.go`
- `go.mod`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/pull_request_template.md`

## Development

### Test

```sh
go test ./...
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
