---
title: CLI Guide
---

# CLI Guide

CoreBlow's CLI entrypoint is `coreblow`. In a source checkout, run the same CLI with `pnpm coreblow ...`; in an npm install, run `coreblow ...` directly.

## Quick Start

```bash
coreblow onboard
coreblow gateway run
coreblow status
coreblow doctor
```

For source development:

```bash
pnpm install
pnpm coreblow onboard
pnpm coreblow gateway run
```

## Global Flags

| Flag | Purpose |
| --- | --- |
| `--container <name>` | Run the CLI inside a named Podman or Docker container. |
| `--dev` | Isolate state under `~/.coreblow-dev` and use the dev gateway port. |
| `--profile <name>` | Isolate config and state under `~/.coreblow-<name>`. |
| `--log-level <level>` | Override file and console logging. |
| `--no-color` | Disable ANSI color output. |
| `-V, --version` | Print the installed CoreBlow version. |
| `-h, --help` | Show command help. |

## Command Groups

### Setup and maintenance

- [`setup`](/cli/setup) - Initialize local config and agent workspace.
- [`onboard`](/cli/onboard) - Interactive onboarding for gateway, workspace, providers, channels, and skills.
- [`configure`](/cli/configure) - Interactive configuration for credentials, channels, gateway, and agent defaults.
- [`config`](/cli/config) - Non-interactive config helpers for get, set, unset, file, schema, and validate.
- [`doctor`](/cli/doctor) - Run health checks and guided repairs for gateway and channels.
- [`dashboard`](/cli/dashboard) - Open the Control UI with the current gateway token.
- [`backup`](/cli/backup) - Create, list, restore, and verify local CoreBlow state backups.
- [`reset`](/cli/reset) - Reset local config or state while keeping the CLI installed.
- [`uninstall`](/cli/uninstall) - Uninstall the gateway service and local data.
- [`update`](/cli/update) - Update CoreBlow and inspect update channel status.
- [`completion`](/cli/completion) - Generate shell completion scripts.

### Gateway operations

- [`gateway`](/cli/gateway) - Run, inspect, and query the WebSocket Gateway.
- [`status`](/cli/status) - Show channel health and recent session recipients.
- [`health`](/cli/health) - Fetch health from the running Gateway.
- [`logs`](/cli/logs) - Tail gateway file logs through RPC.
- [`system`](/cli/system) - Manage system events, heartbeat, and presence.
- [`daemon`](/cli/daemon) - Legacy gateway service alias. Prefer `coreblow gateway ...` for new docs.

### Agents and sessions

- [`agent`](/cli/agent) - Run one agent turn through the Gateway.
- [`agents`](/cli/agents) - Manage isolated agents, workspaces, auth, and routing.
- [`sessions`](/cli/sessions) - List and clean stored conversation sessions.
- [`models`](/cli/models) - Discover, scan, and configure model providers and defaults.
- [`skills`](/cli/skills) - List and inspect available skills.
- [`hooks`](/cli/hooks) - Manage internal agent hooks.
- [`acp`](/cli/acp) - Run Agent Control Protocol tools backed by the Gateway.
- [`mcp`](/cli/mcp) - Manage CoreBlow MCP config and channel bridge.

### Messaging and channels

- [`message`](/cli/message) - Send, read, search, and manage channel messages and moderation actions.
- [`channels`](/cli/channels) - Manage connected chat channels.
- [`directory`](/cli/directory) - Lookup contact and group IDs for supported chat channels.
- [`pairing`](/cli/pairing) - Approve and manage secure DM pairing requests.
- [`qr`](/cli/qr) - Generate iOS pairing QR or setup codes.
- [`webhooks`](/cli/webhooks) - Manage webhook helpers and integrations.

### Nodes and devices

- [`nodes`](/cli/nodes) - Manage gateway-owned node pairing and node commands.
- [`node`](/cli/node) - Run and manage the headless node host service.
- [`devices`](/cli/devices) - Manage device pairing and token rotation.

### Security and runtime controls

- [`approvals`](/cli/approvals) - Manage exec approvals for the gateway or node host.
- [`security`](/cli/security) - Run security tools and local config audits.
- [`secrets`](/cli/secrets) - Control runtime credential reload and audits.
- [`sandbox`](/cli/sandbox) - Manage sandbox containers for agent isolation.
- [`cron`](/cli/cron) - Manage cron jobs through the Gateway scheduler.
- [`dns`](/cli/dns) - Manage DNS helpers for Tailscale and CoreDNS discovery.
- [`docs`](/cli/docs) - Search the live CoreBlow docs.
- [`tui`](/cli/tui) - Open a terminal UI connected to the Gateway.
- [`plugins`](/cli/plugins) - Manage CoreBlow plugin packages.
- [`corebot`](/cli/corebot) - Legacy alias namespace retained for compatibility.

## Notes

- Commands with subcommands print their current tree with `coreblow <command> --help`.
- Machine-readable output is available on commands that expose `--json`.
- The default Gateway port is `18789`; override it with `--port`, `COREBLOW_GATEWAY_PORT`, or config.
