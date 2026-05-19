# CoreBlow Windows Node

Windows companion suite for CoreBlow.

## Overview

CoreBlow Windows Node is part of the CoreBlow public repository family. Windows companion suite for CoreBlow.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 5
- Priority: platform
- Kind: windows
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Windows node solution files.
- Platform-specific build contracts.
- Companion app integration points.

## Out of Scope

- Non-Windows platform packages.
- Core runtime release ownership.

## Key Files

- `CoreBlow.WindowsNode.sln`
- `src/CoreBlow.WindowsNode/CoreBlow.WindowsNode.csproj`
- `src/CoreBlow.WindowsNode/NodeStatus.cs`
- `tests/CoreBlow.WindowsNode.Tests/CoreBlow.WindowsNode.Tests.csproj`
- `tests/CoreBlow.WindowsNode.Tests/NodeStatusTests.cs`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`

## Development

### Build

```sh
dotnet build CoreBlow.WindowsNode.sln
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
