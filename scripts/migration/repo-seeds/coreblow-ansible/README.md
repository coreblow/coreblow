# CoreBlow Ansible

Automated hardened CoreBlow host installation.

## Overview

CoreBlow Ansible is part of the CoreBlow public repository family. Hardened host automation for installing and operating CoreBlow on managed servers.

This repository follows the same ecosystem split that CoreBlow uses to keep release surfaces small, auditable, and independently governed.

## Repository Role

- Phase: 5
- Priority: infra
- Kind: ansible
- Family: CoreBlow public repository family
- Branding: CoreBlow

## Scope

- Ansible playbooks, inventories, and host bootstrap defaults.
- Repeatable server setup for self-hosted CoreBlow deployments.
- Operational checks that can run before a production install.

## Out of Scope

- CoreBlow runtime source code.
- Provider credentials or host-specific inventory values.

## Key Files

- `ansible.cfg`
- `inventory-sample.yml`
- `playbook.yml`
- `requirements.yml`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

## Development

### Syntax check

```sh
ansible-playbook --syntax-check playbook.yml
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
