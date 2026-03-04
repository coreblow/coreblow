<p align="center">
  <img src="https://raw.githubusercontent.com/coreblow/coreblow/main/.github/assets/logo.svg" width="120" alt="CoreBlow" />
</p>

<h1 align="center">CoreBlow</h1>

<p align="center">
  <strong>Autonomous AI agents that run anywhere, powered by any model, fully under your control.</strong>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-→-818cf8?style=for-the-badge" alt="Quick Start" /></a>
  <a href="#-features"><img src="https://img.shields.io/badge/Features-46_files-34d399?style=for-the-badge" alt="Features" /></a>
  <a href="#-channels"><img src="https://img.shields.io/badge/Channels-5-f472b6?style=for-the-badge" alt="Channels" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-eab308?style=for-the-badge" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://github.com/coreblow/coreblow/stargazers"><img src="https://img.shields.io/github/stars/coreblow/coreblow?style=social" alt="Stars" /></a>
  <a href="https://github.com/coreblow/coreblow/network/members"><img src="https://img.shields.io/github/forks/coreblow/coreblow?style=social" alt="Forks" /></a>
</p>

---

## ✨ Why CoreBlow?

> **"Your AI, your rules, your machine."**

CoreBlow is a **self-hosted AI gateway** that connects any AI model to any messaging platform. Send a message on WhatsApp, Telegram, or Discord — and your AI agent responds with full tool access, memory, and personality.

No cloud lock-in. No data leaves your machine. **100% open source.**

| 🔑 | What makes us different |
|:---:|:---|
| 🏠 | **Self-hosted** — runs on your Mac, Linux, or Docker |
| 🆓 | **Free local AI** — Ollama models at zero cost |
| 🔌 | **5 channels** — WhatsApp, Telegram, Discord, WebChat, more coming |
| 🛠️ | **9 AI tools** — exec, browser, search, scrape, cron, and more |
| 🧠 | **Persistent memory** — JSONL sessions with context windowing |
| 🎭 | **Personality** — customize via AGENTS.md, SOUL.md, IDENTITY.md |
| 🔒 | **Secure** — tool profiles, approval system, audit logging |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CoreBlow Gateway                        │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ Channels │  │ Agent Runtime│  │   Tool Registry     │    │
│  │          │  │              │  │                     │    │
│  │ WhatsApp │  │  Bootstrap   │  │  exec    browser    │    │
│  │ Telegram │──│  Sessions    │──│  search  fetch      │    │
│  │ Discord  │  │  Skills      │  │  cron    message    │    │
│  │ WebChat  │  │  Turn Loop   │  │  image   process    │    │
│  └──────────┘  └──────┬───────┘  │  scrape             │    │
│                       │          └────────────────────┘    │
│                       ▼                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               AI Providers (Streaming)                 │ │
│  │  Ollama (FREE)  │  OpenAI  │  Anthropic  │  OpenRouter │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Security │  │ Dashboard│  │  Media   │  │   Config   │  │
│  │ Profiles │  │ WebChat  │  │ Pipeline │  │ Hot-reload │  │
│  │ Approval │  │ Status   │  │ Vision   │  │ Env vars   │  │
│  │ Audit    │  │ Audit    │  │ Audio    │  │  CLI       │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/coreblow/coreblow/main/gateway/scripts/install.sh | bash
```

### Manual install

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow/gateway
npm install

# Interactive setup wizard
npx tsx src/index.ts onboard

# Start the gateway
npx tsx src/index.ts gateway start

# Check system health
npx tsx src/index.ts doctor
```

### Docker

```bash
cd gateway
docker compose up -d
```

This starts the gateway + optional Ollama (local AI) + optional SearXNG (free web search).

---

## 📡 Channels

| Channel | Auth | Group Support | Media | Status |
|:---|:---|:---:|:---:|:---:|
| **WhatsApp** | QR Scan | ✅ Mention-based | ✅ | Ready |
| **Telegram** | Bot Token | ✅ Mention/Reply | ✅ | Ready |
| **Discord** | Bot Token | ✅ Mention-based | ✅ | Ready |
| **WebChat** | Built-in WS | — | — | Ready |
| Slack | Bot Token | ✅ | ✅ | Planned |
| Signal | signal-cli | ✅ | ✅ | Planned |

### Channel Features

- **Anti-ban protection** — typing simulation, message delays (WhatsApp)
- **Auto-reconnect** — exponential backoff with max attempts
- **Message deduplication** — TTL cache prevents double-processing
- **Smart chunking** — long messages split at natural break points
- **Group filtering** — only responds when mentioned or replied to

---

## 🤖 AI Providers

| Provider | Type | Cost | Models |
|:---|:---|:---:|:---|
| **Ollama** | Local | 🆓 Free | Llama 3, Mistral, Gemma, CodeLlama |
| **OpenAI** | Cloud | 💰 | GPT-4o, GPT-4, o1 |
| **Anthropic** | Cloud | 💰 | Claude Opus, Sonnet, Haiku |
| **OpenRouter** | Cloud | 💰 | 100+ models via unified API |

All providers support **streaming** and **tool calls**.

---

## 🛠️ Tools

The AI can use these tools autonomously:

| Tool | What it does |
|:---|:---|
| `exec` | Run shell commands (with timeout + sandbox) |
| `browser` | Control Chromium via Playwright (open, click, type, screenshot) |
| `web_search` | Search the web (Brave → SearXNG → DuckDuckGo fallback) |
| `web_fetch` | Fetch and extract content from URLs |
| `scrape` | Full web scraping via Ultra Skills engine (Playwright + stealth) |
| `cron` | Schedule recurring tasks and reminders |
| `message` | Send messages across channels (cross-channel messaging) |
| `image` | Analyze images with vision models (Ollama llava / OpenAI) |
| `process` | Manage background processes (list, poll, kill) |

### Tool Safety

```
┌─ Tool Profiles ─────────────────────────────────────────┐
│  minimal   → web_fetch only                             │
│  coding    → exec, process, browser, search, image      │
│  messaging → message, cron, web_fetch                   │
│  full      → everything (no restrictions)               │
└─────────────────────────────────────────────────────────┘

┌─ Loop Detection ────────────────────────────────────────┐
│  • Generic repeat (same tool + same args)               │
│  • Poll without progress (same result N times)          │
│  • Ping-pong (A→B→A→B alternation)                      │
│  • Circuit breaker at 30 calls                          │
└─────────────────────────────────────────────────────────┘

┌─ Approval System ───────────────────────────────────────┐
│  ask: off      → auto-approve everything                │
│  ask: on-miss  → ask if not in allowlist                │
│  ask: always   → always ask before executing            │
└─────────────────────────────────────────────────────────┘
```

---

## 🧠 Agent Runtime

### Bootstrap Files

Customize your agent's behavior with markdown files in the workspace:

| File | Purpose |
|:---|:---|
| `AGENTS.md` | Operating instructions + memory |
| `SOUL.md` | Persona, tone, boundaries |
| `IDENTITY.md` | Name, emoji, avatar |
| `TOOLS.md` | Tool usage notes |
| `USER.md` | User profile and preferences |
| `BOOTSTRAP.md` | One-time instructions (deleted after first run) |

### Skills System

Drop `SKILL.md` files into any of these directories:

```
~/.coreblow/skills/       ← Global skills
workspace/skills/         ← Per-workspace skills
gateway/skills/           ← Bundled skills
```

### Sessions

- **JSONL format** — append-only, human-readable
- **Context windowing** — keeps system messages + last N turns
- **Per-channel isolation** — DM = personal, Group = isolated
- **Session management** — list, clear, export

---

## 🔒 Security

| Feature | Description |
|:---|:---|
| **Token auth** | Timing-safe token validation for API/WebSocket |
| **Tool profiles** | Restrict tool access per agent (minimal/coding/full) |
| **Approval system** | Require explicit approval for sensitive tools |
| **Loop detection** | Circuit breaker prevents infinite tool loops |
| **Audit logging** | JSONL audit log with daily rotation |
| **Secret redaction** | API keys hidden in config output |

---

## 📊 Dashboard

Built-in web dashboard at `http://localhost:3120/dashboard`:

- **System status** — health, uptime, active channels
- **WebChat** — chat with your AI directly from the browser
- **Audit log** — view tool executions and auth events
- **Dark theme** — premium glassmorphism design

---

## 🐳 Deployment

### Docker Compose (recommended)

```yaml
services:
  gateway:     # CoreBlow Gateway (port 3120)
  ollama:      # Local AI models (FREE)
  searxng:     # Web search engine (FREE)
```

### Standalone

```bash
npx tsx src/index.ts gateway start
```

### Environment Variables

| Variable | Default | Description |
|:---|:---|:---|
| `COREBLOW_HOME` | `~/.coreblow` | Data directory |
| `COREBLOW_PORT` | `3120` | Gateway port |
| `COREBLOW_TOKEN` | — | Auth token |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `BRAVE_SEARCH_API_KEY` | — | Brave Search key |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama URL |

---

## 🗂️ Project Structure

```
coreblow/
├── gateway/                    # AI Gateway (TypeScript)
│   ├── src/
│   │   ├── agents/            # Agent runtime (5 files)
│   │   ├── channels/          # Channel adapters (5 files)
│   │   ├── cli/               # CLI commands (4 files)
│   │   ├── dashboard/         # Control dashboard (1 file)
│   │   ├── gateway/           # Core server (5 files)
│   │   ├── media/             # Media pipeline (1 file)
│   │   ├── providers/         # AI providers (4 files)
│   │   ├── security/          # Auth, audit, profiles (4 files)
│   │   ├── tools/             # AI tools (11 files)
│   │   ├── utils/             # Logger, store, dedup (3 files)
│   │   └── index.ts           # CLI entry point
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── scripts/install.sh
│
└── ultra-skills/              # Web Scraper Engine (Python)
    ├── scraper/               # Playwright + stealth engine
    ├── worker/                # Cloudflare Workers API
    └── dashboard/             # React scraper dashboard
```

**46 TypeScript files · 5,084 lines · MIT License**

---

## 🛣️ Roadmap

- [x] Gateway daemon + WebSocket protocol
- [x] 4 AI providers (Ollama, OpenAI, Anthropic, OpenRouter)
- [x] 5 channels (WhatsApp, Telegram, Discord, WebChat)
- [x] 9 tools with safety controls
- [x] Bootstrap files + skills system
- [x] Dashboard with WebChat
- [x] Docker deployment
- [ ] Slack + Signal channels
- [ ] Canvas (agent-generated HTML)
- [ ] Mobile nodes (iOS/Android)
- [ ] Plugin system
- [ ] Voice wake + talk mode

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow/gateway
npm install
npx tsx src/index.ts doctor   # Verify setup
```

---

## 📄 License

[MIT](LICENSE) — free for personal and commercial use.

---

<p align="center">
  <strong>Built with ❤️ by the CoreBlow team</strong>
  <br/>
  <sub>Self-hosted AI that actually respects your privacy.</sub>
</p>
