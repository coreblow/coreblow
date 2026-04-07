# CoreBlow Gateway — Security Model

## Overview

CoreBlow implements a defense-in-depth security model with multiple overlapping protection layers. Every user input passes through sanitization, content filtering, and optional sandbox isolation before reaching agent execution.

## Security Architecture

```
             User Input
                 │
         ┌───────▼───────┐
         │ Input Sanitizer│ ← XSS, SQL Injection, Command Injection
         └───────┬───────┘
         ┌───────▼───────┐
         │ Rate Limiter   │ ← Token Bucket per-key limiting
         └───────┬───────┘
         ┌───────▼───────┐
         │ RBAC Check     │ ← Role-based permission enforcement
         └───────┬───────┘
         ┌───────▼───────┐
         │ Guardrails     │ ← Toxicity + Bias + PII + Content filter
         └───────┬───────┘
         ┌───────▼───────┐
         │ Sandbox        │ ← Docker / Native process isolation
         └───────┬───────┘
                 │
           Agent Execution
```

## Components

### 1. Input Sanitizer (`security/input-sanitizer.ts`)

Protects against injection attacks at the boundary:

| Attack Type | Protection |
|-------------|-----------|
| XSS | HTML tag stripping with optional allowlist |
| SQL Injection | Pattern detection for `DROP`, `UNION SELECT`, `OR 1=1` |
| Command Injection | Shell metacharacter + dangerous command detection |
| Path Traversal | `../` stripping, null byte removal |
| URL Injection | Protocol blocking (`javascript:`, `data:`, `file:`) |

**Functions:**
- `sanitizeText(input, options)` — Strip HTML, path traversal, null bytes
- `sanitizeShellArg(input)` — Single-quote wrapping for safe shell use
- `sanitizePath(input)` — Remove traversal sequences
- `sanitizeUrl(url)` — Block dangerous protocols
- `detectInjection(input)` — Multi-vector injection detection
- `sanitizeObject(obj)` — Recursive deep sanitization

### 2. Guardrails Engine (`security/guardrails.ts`)

Unified safety pipeline with configurable enforcement policies:

**Policies:**
| Policy | Toxicity | Bias | PII | Content | Behavior |
|--------|----------|------|-----|---------|----------|
| `strict` | Block (0.3) | Block (0.3) | Block + Mask | Block | Maximum safety |
| `standard` | Block (0.5) | Monitor (0.4) | Mask only | Block | Balanced |
| `permissive` | Monitor (0.7) | Monitor (0.6) | Mask only | Monitor | Minimal blocking |
| `monitor` | Log (0.5) | Log (0.4) | Log only | Log | Observation only |

**Sub-detectors:**
- **ToxicityDetector**: Multi-category scoring (insult, threat, sexual, hate_speech, harassment, spam, violence, self_harm, dangerous_content)
- **BiasDetector**: Gender, racial, age, disability bias detection with recommendations
- **PIIScanner**: Email, phone, SSN, credit card, IP detection with masking
- **ContentFilter**: Violation detection with severity classification

### 3. RBAC System (`security/rbac.ts`)

Role-based access control with hierarchical inheritance:

```
owner (wildcard: *.*)
  └── admin (agents.rwe, channels.rw, config.rw, users.r)
       └── user (agents.re, channels.r)
            └── guest (agents.r)
```

**Features:**
- Built-in roles: `owner`, `admin`, `user`, `guest`
- Custom role creation with permission grants
- Role inheritance (e.g., `moderator` inherits from `user`)
- Multi-role assignment per user
- Circular inheritance protection

### 4. Rate Limiting (`security/token-bucket.ts`)

Token bucket algorithm for per-key rate limiting:

- Configurable capacity and refill rates
- Per-key isolation (user-level, API-key-level)
- Burst handling with configurable maximums
- Wait time calculation for retry-after headers
- Stats tracking (consumed, rejected)

### 5. Sandbox (`security/sandbox.ts`)

Process isolation for command execution:

- **Docker mode**: Full container isolation with resource limits
- **Native mode**: Process-level isolation with command blocklist
- **Blocked commands**: `rm -rf /`, `mkfs`, `dd`, `shutdown`, `reboot`, fork bombs
- Configurable timeout, memory limit, and network access

### 6. Audit Logging (`security/audit-logger.ts`)

Comprehensive audit trail:
- All security decisions logged with timestamps
- Configurable retention periods
- Query interface for compliance reporting

## Zod Validation Schemas

Runtime validation is enforced at all API boundaries:

| Schema | File | Coverage |
|--------|------|----------|
| Config | `config/config.schema.ts` | Gateway, agents, sandbox, tools, channels, models, features, logging |
| Plugin | `plugins/manifest.schema.ts` | Name, version (semver), permissions, tools, hooks, commands |
| API | `gateway/api.schema.ts` | ChatCompletion, session, cron, exec approval, health |
| Webhook | `channels/webhook.schema.ts` | Telegram, Discord, Slack, WhatsApp, generic |

## Security Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| Guardrails Pipeline | 18 | All policies, PII types, batch, stats |
| PII Scanner Deep | 19 | Email, phone, SSN, CC, IP, custom, masking |
| Input Sanitizer | 28 | XSS, SQLi, CMDi, path, URL, shell, math |
| RBAC | 13 | Hierarchy, inheritance, multi-role, revoke |
| Toxicity & Bias | 18 | Detection, severity, thresholds, batch |
| Rate Limiter | 15 | Bucket, refill, burst, per-key, stats |
| **Total** | **111** | |
