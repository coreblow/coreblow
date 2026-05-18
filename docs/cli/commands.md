---
title: CLI Commands Reference
---

# CLI Commands Reference

This reference is aligned with the current `coreblow --help` output in the repository. Run `coreblow <command> --help` for the exact subcommands and options available in your installed build.

## Root Usage

```bash
coreblow [options] [command]
```

## Current Commands

| Command | Description |
| --- | --- |
| [`setup`](/cli/setup) | Initialize local config and agent workspace. |
| [`onboard`](/cli/onboard) | Interactive onboarding for gateway, workspace, providers, channels, and skills. |
| [`configure`](/cli/configure) | Interactive configuration for credentials, channels, gateway, and agent defaults. |
| [`config`](/cli/config) | Non-interactive config helpers for get, set, unset, file, schema, and validate. |
| [`completion`](/cli/completion) | Generate shell completion scripts. |
| [`doctor`](/cli/doctor) | Run health checks and guided repairs for gateway and channels. |
| [`dashboard`](/cli/dashboard) | Open the Control UI with the current gateway token. |
| [`backup`](/cli/backup) | Create, list, restore, and verify local CoreBlow state backups. |
| [`reset`](/cli/reset) | Reset local config or state while keeping the CLI installed. |
| [`uninstall`](/cli/uninstall) | Uninstall the gateway service and local data. |
| [`update`](/cli/update) | Update CoreBlow and inspect update channel status. |
| [`message`](/cli/message) | Send, read, search, and manage channel messages and moderation actions. |
| [`agent`](/cli/agent) | Run one agent turn through the Gateway. |
| [`agents`](/cli/agents) | Manage isolated agents, workspaces, auth, and routing. |
| [`acp`](/cli/acp) | Run Agent Control Protocol tools backed by the Gateway. |
| [`mcp`](/cli/mcp) | Manage CoreBlow MCP config and channel bridge. |
| [`status`](/cli/status) | Show channel health and recent session recipients. |
| [`health`](/cli/health) | Fetch health from the running Gateway. |
| [`sessions`](/cli/sessions) | List and clean stored conversation sessions. |
| [`gateway`](/cli/gateway) | Run, inspect, and query the WebSocket Gateway. |
| [`logs`](/cli/logs) | Tail gateway file logs through RPC. |
| [`system`](/cli/system) | Manage system events, heartbeat, and presence. |
| [`models`](/cli/models) | Discover, scan, and configure model providers and defaults. |
| [`directory`](/cli/directory) | Lookup contact and group IDs for supported chat channels. |
| [`nodes`](/cli/nodes) | Manage gateway-owned node pairing and node commands. |
| [`node`](/cli/node) | Run and manage the headless node host service. |
| [`devices`](/cli/devices) | Manage device pairing and token rotation. |
| [`approvals`](/cli/approvals) | Manage exec approvals for the gateway or node host. |
| [`sandbox`](/cli/sandbox) | Manage sandbox containers for agent isolation. |
| [`tui`](/cli/tui) | Open a terminal UI connected to the Gateway. |
| [`cron`](/cli/cron) | Manage cron jobs through the Gateway scheduler. |
| [`dns`](/cli/dns) | Manage DNS helpers for Tailscale and CoreDNS discovery. |
| [`docs`](/cli/docs) | Search the live CoreBlow docs. |
| [`hooks`](/cli/hooks) | Manage internal agent hooks. |
| [`webhooks`](/cli/webhooks) | Manage webhook helpers and integrations. |
| [`pairing`](/cli/pairing) | Approve and manage secure DM pairing requests. |
| [`qr`](/cli/qr) | Generate iOS pairing QR or setup codes. |
| [`plugins`](/cli/plugins) | Manage CoreBlow plugin packages. |
| [`channels`](/cli/channels) | Manage connected chat channels. |
| [`security`](/cli/security) | Run security tools and local config audits. |
| [`secrets`](/cli/secrets) | Control runtime credential reload and audits. |
| [`skills`](/cli/skills) | List and inspect available skills. |
| [`daemon`](/cli/daemon) | Legacy gateway service alias. Prefer `coreblow gateway ...` for new docs. |
| [`corebot`](/cli/corebot) | Legacy alias namespace retained for compatibility. |

## Common Workflows

```bash
coreblow onboard
coreblow gateway run
coreblow status --all
coreblow channels status
coreblow message send --channel telegram --target @mychat --message "Hi"
coreblow models list
coreblow update status
```

## Source Checkout Workflows

```bash
pnpm install
pnpm coreblow --help
pnpm coreblow gateway run
pnpm check
pnpm test
pnpm build
```

## Gateway CI

Gateway tests are split into three GitHub Actions shards. The workflow runs `pnpm test:gateway` with `COREBLOW_TEST_SHARDS=3` and one `COREBLOW_TEST_SHARD_INDEX` per matrix job, then type-checks and builds declarations.
