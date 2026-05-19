# CoreBlow Ansible

Automated hardened CoreBlow host installation.

This repository owns infrastructure automation for self-hosted CoreBlow hosts:
package installation, firewall posture, service layout, and operational
defaults. It is separate from the runtime so host policy can change without
shipping application code.

## Development

```sh
ansible-playbook --syntax-check playbook.yml
```
