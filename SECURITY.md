# Security Policy

If you believe you've found a security issue in CoreBlow, please report it privately.

## Reporting

Report vulnerabilities via GitHub Security Advisories or email:

- **Core CLI and Gateway** — [coreblow/coreblow](https://github.com/coreblow/coreblow)
- **Email** — [security@coreblow.com](mailto:security@coreblow.com)

### Required in Reports

1. **Title** — descriptive summary
2. **Severity Assessment** — CVSS score or qualitative (critical/high/medium/low)
3. **Impact** — what an attacker can achieve
4. **Affected Component** — file, function, line range
5. **Technical Reproduction** — step-by-step PoC against latest `main`
6. **Demonstrated Impact** — proof of the security boundary crossed
7. **Environment** — CoreBlow version, Node.js version, OS
8. **Remediation Advice** — suggested fix approach

Reports without reproduction steps, demonstrated impact, and remediation advice will be deprioritized.

### Report Acceptance Gate

For fastest triage, include:

- Exact vulnerable path (`file`, function, and line range) on a current revision
- Tested version details (CoreBlow version and/or commit SHA)
- Reproducible PoC against latest `main` or latest released version
- Demonstrated impact tied to CoreBlow's documented trust boundaries
- Explicit statement that the report does not rely on adversarial operators sharing one gateway
- Scope check explaining why the report is **not** covered by the Out of Scope section below

### Common False-Positive Patterns

These are frequently reported but typically closed with no code change:

- Prompt-injection-only chains without a boundary bypass (prompt injection is out of scope)
- Operator-intended local features presented as remote injection
- Reports that treat explicit operator-control surfaces (e.g., sandbox eval, browser tools) as vulnerabilities without demonstrating an auth/policy/sandbox boundary bypass
- Authorized user-triggered local actions presented as privilege escalation
- Reports that only show a malicious plugin executing privileged actions after a trusted operator installs it
- Reports that assume per-user multi-tenant authorization on a shared gateway
- Scanner-only claims without a working reproduction
- Missing HSTS findings on default local/loopback deployments

### Duplicate Report Handling

- Search existing advisories before filing
- Maintainers may close lower-quality/later duplicates in favor of the earliest high-quality report

## Security & Trust Contact

For security inquiries: **[security@coreblow.com](mailto:security@coreblow.com)**

We will respond within 48 hours and work with you to fix the issue.

## Operator Trust Model

CoreBlow's security model is **"personal assistant"** — one trusted operator, potentially many agents — not a shared multi-tenant bus.

- Authenticated Gateway callers are treated as **trusted operators** for that gateway instance
- Session identifiers (`sessionKey`, session IDs) are routing controls, **not** per-user authorization boundaries
- If one operator can view data from another on the same gateway, that is expected behavior
- **Recommended mode:** one user per machine/host, one gateway for that user
- For multiple users, use one VPS (or host/OS user boundary) per user
- Exec behavior is host-first by default: `agents.defaults.sandbox.mode` defaults to `off`

## Plugin Trust Boundary

Plugins/extensions are part of CoreBlow's **trusted computing base** for a gateway.

- Installing or enabling a plugin grants it the same trust level as local code
- Plugin behavior such as reading env/files or running host commands is expected inside this trust boundary
- Security reports must show a boundary bypass (e.g., unauthenticated plugin load, allowlist bypass, sandbox bypass), not only malicious behavior from a trusted-installed plugin
- Only install plugins you trust, and prefer `plugins.allow` to pin explicit trusted plugin IDs

## Gateway Trust Concept

CoreBlow separates routing from execution, but both remain inside the same operator trust boundary:

- **Gateway** is the control plane. Passing Gateway auth means trusted operator access
- **Exec approvals** (allowlist/ask UI) are operator guardrails, not a multi-tenant authorization boundary
- For untrusted-user isolation, split by trust boundary: separate gateways per boundary

## Channel Adapter Security

Each channel adapter requires its own authentication credentials:

| Channel | Auth Method | Config Key |
|---------|------------|------------|
| Discord | Bot Token | `channels.discord.token` |
| Telegram | Bot Token | `channels.telegram.token` |
| Slack | Bot Token + Signing Secret | `channels.slack.token` |
| Signal | Phone + Password | `channels.signal.password` |
| Gmail | App Password | `channels.gmail.appPassword` |
| WhatsApp | API Token | `channels.whatsapp.token` |
| iMessage | AppleScript (local only) | N/A |

**Best practices:**
- Use secret providers (`secret:env:default:VAR_NAME`) instead of plaintext config values
- Rotate channel tokens regularly
- Use minimal bot permissions (principle of least privilege)

## Secrets Management

CoreBlow implements a 3-source secret provider model:

### Environment Variables (`env`)
```yaml
secrets:
  providers:
    default:
      source: env
      allowlist: [OPENAI_API_KEY, DISCORD_TOKEN]
```

### File Providers (`file`)
```yaml
secrets:
  providers:
    vault-secrets:
      source: file
      path: /run/secrets/coreblow.json
      mode: json  # or singleValue
```
- File permissions are validated (must be `0600`)
- Symlink targets are verified
- File ownership is checked against current user

### Exec Providers (`exec`)
```yaml
secrets:
  providers:
    vault:
      source: exec
      command: /usr/local/bin/vault-fetch
      timeoutMs: 5000
      maxOutputBytes: 1048576
```
- Command path security validation (ownership, permissions, symlinks)
- Sandboxed subprocess execution (cleaned environment)
- Protocol v1 JSON request/response format
- Timeout enforcement and output size limits

### Encryption at Rest

CoreBlow uses **AES-256-GCM** with PBKDF2 key derivation for encrypting stored secrets:
- 100,000 iteration PBKDF2 with SHA-512
- Random salt and IV per encryption operation
- Authentication tag for tamper detection
- Key rotation with 7-day grace period for re-encryption

## Tool Execution Safety

CoreBlow provides multiple layers of tool execution control:

- **Tool profiles** restrict tool access per agent (`tools.profile: "messaging"`)
- **Approval system** for sensitive tool executions (`ask: on-miss`)
- **Loop detection** prevents runaway tool execution
- **Sandbox mode** for isolated Docker-based code execution
- **Allowlists** for permitted tool/command combinations

## Deployment Guidance

### Recommended Configuration

- Keep the Gateway **loopback-only** (`127.0.0.1`) — this is the default
- **Do not** expose the Gateway to the public internet
- For remote access, use an SSH tunnel or Tailscale serve/funnel
- Always set a Gateway token: `COREBLOW_TOKEN=your-secret-token`

### Docker Security

The official Docker image includes:

1. **Non-root user** (`node`, uid 1000) — reduces container escape attack surface
2. **Bookworm-slim base** — minimal attack surface, regular security updates
3. **Health checks** — automatic container restart on failure
4. **No source code** — only compiled runtime assets in production image

Example secure Docker run:

```bash
docker run --read-only --cap-drop=ALL \
  -v coreblow-data:/app/data \
  -e COREBLOW_TOKEN=your-secret-token \
  -p 127.0.0.1:3000:3000 \
  coreblow/coreblow-gateway:latest
```

### TLS/HTTPS

CoreBlow does not terminate TLS directly. Use a reverse proxy:

```bash
# Recommended: Caddy (automatic HTTPS)
caddy reverse-proxy --from coreblow.example.com --to localhost:3000
```

## Workspace Memory Trust Boundary

`MEMORY.md` and `memory/*.md` are plain workspace files treated as **trusted local operator state**.

- If someone can edit workspace memory files, they already crossed the operator boundary
- Memory search/recall over those files is expected behavior
- For isolation between users, split by OS user or host

## Temp Folder Boundary

CoreBlow uses a dedicated temp root for media handoff:

- Preferred: `/tmp/coreblow` (when available)
- Fallback: `os.tmpdir()/coreblow`
- Sandbox media validation allows temp paths only under the CoreBlow-managed temp root
- Plugin/extension code should use CoreBlow temp helpers, not raw `os.tmpdir()`

## Out of Scope

- Public Internet exposure — use a reverse proxy
- Using CoreBlow in ways the docs explicitly warn against
- Deployments where mutually untrusted operators share one gateway
- Prompt-injection-only attacks without a policy/auth/sandbox boundary bypass
- Reports requiring write access to trusted local state (`~/.coreblow`, workspace files)
- Reports treating operator-enabled dangerous config options as vulnerabilities
- ReDoS/DoS claims requiring trusted operator config input without a boundary bypass
- Reports that only show heuristic/parity differences without a trust-boundary bypass

## Runtime Requirements

### Node.js Version

CoreBlow requires **Node.js 22.12.0 or later** (LTS).

```bash
node --version  # Should be v22.12.0 or later
```

### Security Scanning

This project uses automated secret detection in CI/CD:

```bash
# Run locally
pip install detect-secrets==1.5.0
detect-secrets scan --baseline .secrets.baseline
```

## Best Practices Summary

1. **Always set a gateway token:** `COREBLOW_TOKEN=your-secret-token`
2. **Use secret providers** instead of plaintext config values
3. **Use tool profiles** to restrict agent capabilities
4. **Enable approval mode** for production: `ask: on-miss`
5. **Run in Docker** for process isolation
6. **Keep loopback-only** — use SSH tunnel for remote access
7. **Rotate credentials** regularly (channel tokens, encryption keys)
8. **Keep dependencies updated** — run `pnpm audit` regularly
9. **Review audit logs** — enable structured JSON logging in production
10. **Use sandbox mode** for code execution: `agents.defaults.sandbox.mode: "all"`
