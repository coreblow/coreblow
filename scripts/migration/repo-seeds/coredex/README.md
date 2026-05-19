# CoreDex

CoreBlow contacts and identity surface.

## Overview

CoreDex is part of the CoreBlow public repository family. Contacts and identity surface for CoreBlow applications.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 4
- Priority: app
- Kind: contacts
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Identity data structures.
- Contact-oriented workflows.
- Application tests for the contact surface.

## Out of Scope

- Credential storage.
- Messaging provider transport code.

## Key Files

- `coredex_test.go`
- `coredex.go`
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
