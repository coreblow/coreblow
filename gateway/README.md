# 🤖 CoreBlow Gateway

**Self-hosted AI assistant platform** — connect any AI model to any chat channel.

> Personal AI assistant — **fast setup**, **clean code**, **extensible features**.

[![Tests](https://img.shields.io/badge/tests-576%20passed-brightgreen)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-0%20errors-blue)](#) [![License](https://img.shields.io/badge/license-MIT-purple)](#)

---

## ⚡ Quick Start (5 minutes)

```bash
# 1. Clone & install
git clone https://github.com/coreblow/gateway.git
cd gateway && npm install

# 2. Initialize project
npx coreblow init

# 3. Run the setup wizard
npx coreblow onboard

# 4. Start!
npx coreblow start
```

That's it. Your AI assistant is running. 🚀

---

## 🎯 Why CoreBlow?

| | CoreBlow | Others |
|---|---------|---------|
| **Setup time** | 5 minutes | 30+ minutes |
| **Codebase** | ~40 files, clean | 752 files, scattered |
| **Tests** | 576 passing | varies |
| **Plugin sandbox** | ✅ Permission-based | ❌ No sandboxing |
| **Message queue** | ✅ Priority + circuit breaker | ❌ Synchronous |
| **Conversation fork** | ✅ Branch & merge | ❌ Linear only |
| **CLI tools** | 12 commands | limited |
| **Config validation** | ✅ Schema + migration | ❌ Manual |

---

## 📦 Features

### AI Providers
- **Ollama** — Free, local models (Llama, Mistral, etc.)
- **OpenAI** — GPT-4o, GPT-4-turbo
- **Anthropic** — Claude Sonnet, Opus
- **OpenRouter** — 100+ models with one API key
- **Google** — Gemini models

### Chat Channels
- 💬 **Telegram** — Full bot integration
- 🎮 **Discord** — Server bot with slash commands
- 💼 **Slack** — Workspace integration
- 🌐 **WebChat** — Built-in web interface
- 📱 **WhatsApp** — Via QR code pairing

### Agent System
- 🎭 **Personas** — 6 built-in templates (coder, tutor, creative, etc.)
- 🧠 **Context Management** — Smart token budgeting
- 🔀 **Conversation Forking** — Branch, merge, compare conversations
- 🤖 **Multi-Agent** — Route to different agents per channel/user
- ⚡ **Lifecycle Hooks** — Middleware pipeline with guardrails

### Command Framework
- 12 built-in commands (`/help`, `/persona`, `/session`, etc.)
- Custom command registration with permissions
- Subcommands, flags, aliases, argument validation

### Plugin System
- 🧩 **Plugin SDK** — Simple extension interface
- 🔒 **Sandbox** — Permission-based security
- 📦 **Marketplace** — Install, enable, disable plugins
- 🛠 **CLI** — `coreblow plugin create my-plugin`

### Infrastructure
- 📊 **Priority Queue** — High/normal/low with backpressure
- 🔄 **Retry + Circuit Breaker** — Exponential backoff
- 🎯 **VIP Routing** — Priority tiers per user/channel
- ⚙️ **Config Validation** — Schema, migration, defaults

---

## 🛠 CLI Reference

```bash
coreblow init [template]       # Initialize project (default/telegram/discord/multi/openai/anthropic)
coreblow start                 # Start the gateway
coreblow onboard               # Interactive setup wizard
coreblow configure [section]   # Edit config (provider/channels/port)
coreblow doctor                # System health check
coreblow plugin <action>       # Manage plugins (list/create/validate/enable/disable)
coreblow channels [action]     # View channel connections
coreblow pair [action]         # Device pairing
coreblow logs [action]         # View logs (tail/sessions/audit/clear)
coreblow platform [action]     # Auto-start service (launchd/systemd)
coreblow skillhub [action]     # Manage skills
coreblow gateway <action>      # Daemon management (start/status/stop)
```

---

## 📝 Config Examples

Copy an example config to get started fast:

```bash
# Minimal (Ollama, free)
cp examples/config.minimal.json ~/.coreblow/config.json

# Telegram bot
cp examples/config.telegram.json ~/.coreblow/config.json

# Multi-channel + OpenAI
cp examples/config.full.json ~/.coreblow/config.json

# OpenRouter (100+ models)
cp examples/config.openrouter.json ~/.coreblow/config.json
```

Then edit the config:
```bash
coreblow configure
```

---

## 🧩 Creating a Plugin

```bash
# Scaffold a new plugin
coreblow plugin create my-plugin

# Structure created:
# my-plugin/
#   plugin.json    — manifest
#   index.js       — entry point
```

```javascript
// my-plugin/index.js
module.exports = {
    meta: { name: 'my-plugin', version: '1.0.0', description: 'My plugin' },

    hooks: {
        async onMessage(message) {
            console.log(`Received: ${message.text}`);
        },
    },

    async init(context) {
        // context.config — plugin config
        // context.gateway.registerTool() — add custom tools
    },
};
```

```bash
# Install: copy to extensions dir
cp -r my-plugin ~/.coreblow/extensions/

# Restart gateway
coreblow start
```

---

## 🏗 Architecture

```
gateway/
├── src/
│   ├── agents/          # Persona, context, lifecycle, fork, multi-agent
│   ├── auto-reply/      # Reply engine, triggers, chunking
│   ├── channels/        # Telegram, Discord, Slack, WebChat
│   ├── cli/             # 12 CLI commands
│   ├── commands/        # Command framework + built-ins
│   ├── gateway/         # Server, router, queue, retry, orchestrator
│   ├── plugins/         # SDK, loader, registry, sandbox, marketplace
│   ├── providers/       # Ollama, OpenAI, Anthropic, OpenRouter
│   ├── tools/           # Exec, web fetch, cron, image, canvas
│   └── utils/           # Logger, store, i18n
├── tests/               # 576 tests across 34 files
└── examples/            # Ready-to-use config templates
```

---

## 🧪 Development

```bash
# Run in dev mode (hot reload)
npm run dev

# Run tests
npm test

# Type check
npm run lint

# Build
npm run build
```

---

## 📄 License

MIT — use it however you want.
