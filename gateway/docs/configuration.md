# CoreBlow Gateway — Configuration Reference

## Overview

CoreBlow uses a JSON configuration file validated at startup by Zod schemas. All fields have sensible defaults — an empty `{}` produces a fully functional configuration.

## Configuration File

CoreBlow looks for configuration in this order:
1. `./coreblow.json` (project root)
2. `~/.coreblow/config.json` (user home)
3. Environment variables with `COREBLOW_` prefix

## Full Schema

```json
{
  "version": "1.0",
  "gateway": {
    "port": 3577,
    "host": "127.0.0.1",
    "cors": true,
    "maxConnections": 100,
    "timeout": 30000,
    "auth": {
      "token": "your-secret-token",
      "password": "optional-password"
    },
    "reload": {
      "mode": "hybrid"
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-20250514",
      "temperature": 0.7,
      "maxTokens": 8192,
      "timeout": 300,
      "maxTurns": 25,
      "autoCompact": true,
      "compactThreshold": 0.8
    },
    "list": [
      {
        "id": "coder",
        "name": "Code Agent",
        "tools": { "profile": "coding" }
      }
    ]
  },
  "sandbox": {
    "mode": "off",
    "image": "coreblow/sandbox:latest",
    "network": "none",
    "cpus": 2,
    "memoryMb": 2048,
    "idleTimeoutHours": 4,
    "maxAgeDays": 7
  },
  "tools": {
    "profile": "coding",
    "exec": {
      "ask": "on-miss",
      "allowlist": ["ls", "cat", "grep"],
      "denylist": ["rm -rf"]
    }
  },
  "channels": {
    "discord": { "enabled": true, "token": "..." },
    "telegram": { "enabled": false }
  },
  "models": {
    "default": "anthropic/claude-sonnet-4-20250514",
    "aliases": {
      "sonnet": "anthropic/claude-sonnet-4-20250514",
      "opus": "anthropic/claude-opus-4-20250514",
      "gpt4": "openai/gpt-4o",
      "gemini": "google/gemini-2.5-flash"
    }
  },
  "features": {
    "dashboard": true,
    "cron": true,
    "canvas": true,
    "autoReply": true,
    "webSearch": false
  },
  "logging": {
    "level": "info",
    "format": "text"
  }
}
```

## Field Reference

### Gateway

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `port` | integer | `3577` | 1–65535 |
| `host` | string | `127.0.0.1` | — |
| `cors` | boolean | `true` | — |
| `maxConnections` | integer | `100` | ≥1 |
| `timeout` | integer | `30000` | ≥1000ms |
| `auth.token` | string | — | optional |
| `reload.mode` | enum | `hybrid` | `hybrid`, `full`, `off` |

### Agents

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `temperature` | number | `0.7` | 0–2 |
| `maxTokens` | integer | `8192` | 1–2,000,000 |
| `timeout` | integer | `300` | 1–3600s |
| `maxTurns` | integer | `25` | 1–100 |
| `autoCompact` | boolean | `true` | — |
| `compactThreshold` | number | `0.8` | 0–1 |

### Sandbox

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `mode` | enum | `off` | `off`, `container`, `firecracker` |
| `image` | string | `coreblow/sandbox:latest` | — |
| `network` | enum | `none` | `none`, `host`, `bridge` |
| `cpus` | integer | `2` | 1–16 |
| `memoryMb` | integer | `2048` | 256–32768 |
| `idleTimeoutHours` | number | `4` | ≥0.1 |
| `maxAgeDays` | integer | `7` | ≥1 |

### Tools

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `profile` | enum | `coding` | `minimal`, `coding`, `messaging`, `full` |
| `exec.ask` | enum | `on-miss` | `off`, `on-miss`, `always` |
| `exec.allowlist` | string[] | `[]` | — |
| `exec.denylist` | string[] | `[]` | — |

### Logging

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `level` | enum | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `format` | enum | `text` | `text`, `json` |

## Programmatic Usage

```typescript
import { validateConfig, safeValidateConfig, mergeWithDefaults } from './config/config.schema.js';

// Validate and get full config with defaults
const config = validateConfig({ gateway: { port: 8080 } });

// Safe validation (no throw)
const result = safeValidateConfig(rawConfig);
if (!result.success) {
  result.errors.forEach(e => console.error(e));
}

// Merge partial overrides into defaults
const merged = mergeWithDefaults({ logging: { level: 'debug' } });
```

## Environment Variables

All config values can be overridden via environment variables:

```bash
COREBLOW_GATEWAY_PORT=8080
COREBLOW_AGENTS_TEMPERATURE=0.5
COREBLOW_LOGGING_LEVEL=debug
COREBLOW_SANDBOX_MODE=container
```
