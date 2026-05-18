<p align="center">
  <img src="https://raw.githubusercontent.com/coreblow/coreblow/main/.github/assets/logo.svg" width="96" alt="CoreBlow" />
</p>

# CoreBlow - Enterprise AI Gateway

[Website](https://coreblow.com) |
[Docs](https://docs.coreblow.com/) |
[CLI](https://docs.coreblow.com/cli) |
[Configuration](https://docs.coreblow.com/configuration) |
[Security](https://docs.coreblow.com/security) |
[npm](https://www.npmjs.com/package/coreblow)

CoreBlow is a self-hosted AI gateway and agent runtime for operators who need a
gateway-first assistant platform: model flexibility, messaging automation,
controlled tool execution, and a plugin system that runs under their own
infrastructure.

The runtime is built around enterprise OOP patterns: service classes,
dependency injection, registries, explicit runtime boundaries, and a public
plugin SDK. It can run locally, in Docker, or as a managed gateway process while
keeping agent state, credentials, and operational policy under the operator's
control.

If you want a personal assistant stack with enterprise-style boundaries,
operator-owned infrastructure, and a TypeScript OOP architecture, CoreBlow is
the project.

Supported provider paths include local Ollama, OpenAI-compatible APIs,
Anthropic, Gemini, OpenRouter-style routing, and plugin-backed providers.
Supported runtime surfaces include built-in channels, plugin channels,
WebSocket clients, Control UI, cron, nodes, and MCP/ACP integration.

## Install

Runtime: Node.js 22.12 or newer.

```bash
npm install -g coreblow
coreblow onboard
coreblow gateway run
```

`coreblow onboard` walks through the gateway, workspace, model provider,
channel, and skills setup. The default local gateway port is `18789`.

## Quick Start

Source checkout:

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow
pnpm install
pnpm coreblow onboard
pnpm coreblow gateway run
```

Docker Compose:

```bash
docker compose up -d
```

The Compose profile publishes port `3000` by default for containerized
deployments.

## Security Defaults

CoreBlow defaults to local operation and expects exposed deployments to be
explicitly configured.

- Set `COREBLOW_GATEWAY_TOKEN` for gateway authentication in non-local setups.
- Keep the gateway bound to loopback unless LAN, tailnet, or proxy exposure is
  intentional.
- Use approval policy for shell execution and other sensitive tools.
- Keep secrets in environment variables, credential refs, or configured secret
  providers rather than committing plaintext config.
- Run `coreblow doctor` and `coreblow security audit` before exposing the
  gateway or shipping a production image.

## Highlights

- Self-hosted gateway for agent sessions, channels, tools, cron, nodes, and
  operator clients.
- Gateway-first product model: the gateway is the control plane for assistants,
  plugins, channels, and operator workflows.
- OOP runtime architecture with `ServiceRegistry`, plugin registries, typed
  config surfaces, and explicit lifecycle boundaries.
- Public plugin SDK for providers, tools, hooks, commands, and channel
  integrations.
- Multi-provider model configuration with provider auth profiles, fallbacks,
  image model selection, and model scanning.
- Controlled tool execution for shell, browser, web fetch/search, messaging,
  cron, media, canvas, RAG, and background processes.
- Persistent sessions, workspace bootstrap files, skills, and context
  management for long-running agents.
- Operational surfaces for health checks, logs, service lifecycle, update
  checks, Docker, and CI-friendly test wrappers.

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/agents/` | Agent engine integration, embedded runner, turn execution, and session flow. |
| `src/gateway/` | Gateway server, RPC/API surface, WebSocket control plane, and DI registration. |
| `src/cli/` | CLI command groups, profiles, help, and command-specific utilities. |
| `src/config/` | Config schemas, validation, defaults, migrations, and config I/O. |
| `src/plugins/` | Internal plugin loader, registry, metadata, lifecycle, and runtime integration. |
| `src/plugin-sdk/` | Public plugin API for third-party integrations. |
| `src/security/` | Audits, policy checks, profiles, approvals, and guardrails. |
| `src/channels/` | Shared channel abstractions, routing, directory, and policy logic. |
| `extensions/` | Workspace plugin packages. |
| `packages/` | Shared packages used by CoreBlow and plugin-facing surfaces. |

## Security Model

CoreBlow treats the gateway as the control plane and makes operator policy
explicit.

- Gateway authentication supports token and password-backed flows.
- Tool approval modes govern sensitive actions.
- Exec policy and sandbox controls limit high-risk execution paths.
- Secret redaction is applied to config and command output.
- Audit logs record gateway and tool activity.
- Local security checks are available through CLI audits.
- Remote or internet-facing deployments should use strong gateway credentials,
  strict origin/proxy configuration, and an intentional bind mode.

Read the security guide before exposing the gateway:
[https://docs.coreblow.com/security](https://docs.coreblow.com/security)

## Operator Quick Refs

| Goal | Command |
| --- | --- |
| Start guided setup | `coreblow onboard` |
| Edit runtime config | `coreblow configure` |
| Run gateway in foreground | `coreblow gateway run` |
| Check gateway service and reachability | `coreblow gateway status` |
| Show channel and session status | `coreblow status --all` |
| Fetch health from the running gateway | `coreblow health --json` |
| Inspect model provider state | `coreblow models status` |
| Send a channel message | `coreblow message send --help` |
| Manage plugins | `coreblow plugins --help` |
| Manage exec approvals | `coreblow approvals --help` |
| Run health checks and repairs | `coreblow doctor` |
| Run security audit | `coreblow security audit` |

## Development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Useful development commands:

```bash
pnpm coreblow --help
pnpm coreblow --dev gateway
pnpm test:gateway
pnpm typecheck
```

Release and publish workflows are operator-controlled. Do not change version
numbers or publish packages without explicit release approval.

## Docs by Goal

- New setup: [https://docs.coreblow.com/install](https://docs.coreblow.com/install)
- CLI commands: [https://docs.coreblow.com/cli](https://docs.coreblow.com/cli)
- Gateway operation: [https://docs.coreblow.com/gateway](https://docs.coreblow.com/gateway)
- Configuration reference: [https://docs.coreblow.com/configuration](https://docs.coreblow.com/configuration)
- Providers: [https://docs.coreblow.com/providers](https://docs.coreblow.com/providers)
- Channels: [https://docs.coreblow.com/channels](https://docs.coreblow.com/channels)
- Plugin development: [https://docs.coreblow.com/plugins](https://docs.coreblow.com/plugins)
- Security: [https://docs.coreblow.com/security](https://docs.coreblow.com/security)

## License

CoreBlow is released under the [MIT License](LICENSE).
