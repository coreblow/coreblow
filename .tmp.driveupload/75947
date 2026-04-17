# CoreBlow Gateway — Plugin Development Guide

## Overview

CoreBlow supports a rich plugin system for extending gateway functionality. Plugins can add tools, hooks, commands, and custom behaviors with fine-grained permission control.

## Plugin Manifest

Every plugin requires a `manifest.json` validated against a Zod schema:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A sample CoreBlow plugin",
  "author": "Your Name",
  "license": "MIT",
  "permissions": ["fs", "network"],
  "entrypoint": "index.js",
  "tools": [
    {
      "name": "my-tool",
      "description": "Does something useful",
      "parameters": { "input": { "type": "string" } }
    }
  ],
  "hooks": [
    {
      "event": "message",
      "handler": "onMessage",
      "priority": 100
    }
  ],
  "commands": [
    {
      "name": "my-command",
      "description": "Runs my custom command",
      "aliases": ["mc"]
    }
  ]
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string(1-100) | ✅ | Plugin identifier |
| `version` | semver | ✅ | Version (e.g., `1.0.0`, `2.0.0-beta.1`) |
| `description` | string(0-1000) | ❌ | Plugin description |
| `author` | string(0-200) | ❌ | Author name |
| `license` | string | ❌ | SPDX license identifier |
| `homepage` | URL | ❌ | Plugin homepage |
| `permissions` | Permission[] | ❌ | Required permissions (default: `[]`) |
| `entrypoint` | string | ❌ | Entry file (default: `index.js`) |
| `tools` | Tool[] | ❌ | Tools exposed by plugin |
| `hooks` | Hook[] | ❌ | Event hooks |
| `commands` | Command[] | ❌ | Chat commands |
| `minGatewayVersion` | string | ❌ | Minimum gateway version |

### Permissions

Plugins must declare required permissions:

| Permission | Access |
|------------|--------|
| `fs` | Filesystem read/write |
| `network` | HTTP/WebSocket connections |
| `exec` | Shell command execution |
| `env` | Environment variable access |
| `clipboard` | System clipboard |
| `notifications` | Desktop notifications |

## Plugin Lifecycle

```
  discover → validate → install → enable → (running) → disable → uninstall
                │                                           │
                └──── manifest validation (Zod)            │
                                                           │
                      hooks detached, tools unregistered ◄─┘
```

### States

1. **Discovered** — Found in plugin directory
2. **Validated** — Manifest passes schema validation
3. **Installed** — Dependencies resolved, files in place
4. **Enabled** — Hooks attached, tools registered, commands active
5. **Disabled** — Hooks detached, tools removed, state preserved
6. **Uninstalled** — Files removed, state cleaned up

## Writing a Plugin

### Minimal Plugin

```typescript
// index.ts
export default {
  name: 'hello-plugin',

  onEnable(ctx) {
    ctx.log.info('Hello plugin enabled!');
  },

  onDisable(ctx) {
    ctx.log.info('Hello plugin disabled');
  },

  tools: {
    greet: {
      description: 'Greet a user',
      parameters: { name: { type: 'string', required: true } },
      execute: async ({ name }) => `Hello, ${name}!`,
    },
  },
};
```

### Hook Plugin

```typescript
export default {
  name: 'logger-plugin',

  hooks: {
    'message:before': async (ctx, message) => {
      ctx.log.info(`Incoming: ${message.content.slice(0, 50)}`);
      return message; // pass through
    },

    'message:after': async (ctx, response) => {
      ctx.log.info(`Outgoing: ${response.text?.slice(0, 50)}`);
      return response;
    },
  },
};
```

### Command Plugin

```typescript
export default {
  name: 'status-plugin',

  commands: {
    status: {
      description: 'Show system status',
      aliases: ['s'],
      execute: async (ctx) => {
        const stats = ctx.gateway.getStats();
        return `Uptime: ${stats.uptimeHuman}\nAgents: ${stats.agents}`;
      },
    },
  },
};
```

## Validation

Manifests are validated at install time using Zod:

```typescript
import { validatePluginManifest } from './plugins/manifest.schema.js';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
const validated = validatePluginManifest(manifest);
// Throws ZodError with detailed path + message on failure
```

Safe validation (no throw):

```typescript
import { safeValidatePluginManifest } from './plugins/manifest.schema.js';

const result = safeValidatePluginManifest(rawManifest);
if (!result.success) {
  console.error('Manifest errors:', result.errors);
}
```

## Security Considerations

- Plugins run in the gateway process unless sandbox mode is enabled
- Network and filesystem access require explicit permission grants
- Exec permissions are gated by the sandbox policy
- Plugin code is not eval'd; only ES module imports are used
- The RBAC system controls which roles can install/enable plugins
