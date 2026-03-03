<p align="center">
  <img src="https://raw.githubusercontent.com/coreblow/coreblow/main/.github/assets/logo.svg" width="120" alt="CoreBlow" />
</p>

<h1 align="center">CoreBlow</h1>

<p align="center">
  <strong>Autonomous AI agents that run anywhere, powered by any model, fully under your control.</strong>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-→-818cf8?style=for-the-badge" alt="Quick Start" /></a>
  <a href="#-features"><img src="https://img.shields.io/badge/Modules-65-34d399?style=for-the-badge" alt="Modules" /></a>
  <a href="#-extensions"><img src="https://img.shields.io/badge/Extensions-101-f472b6?style=for-the-badge" alt="Extensions" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-eab308?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/@coreblow/coreblow"><img src="https://img.shields.io/badge/npm-v1.0.0--rc.1-cb3837?style=for-the-badge" alt="npm" /></a>
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
| 🔌 | **101 extensions** — WhatsApp, Telegram, Discord, Slack, and 97 more |
| 🛠️ | **Full tool suite** — exec, browser, search, scrape, cron, canvas, and more |
| 🧠 | **Persistent memory** — JSONL sessions with context windowing + RAG |
| 🎭 | **Personality** — customize via AGENTS.md, SOUL.md, IDENTITY.md |
| 🔒 | **Enterprise security** — tool profiles, approval system, audit logging, sandboxing |
| 🔌 | **Plugin SDK** — build and distribute your own extensions |
| 📊 | **Observability** — OpenTelemetry + built-in diagnostics |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CoreBlow Runtime                             │
│                                                                     │
│  ┌───────────┐  ┌────────────────┐  ┌──────────────────────┐       │
│  │ Extensions│  │  Agent Engine  │  │   Tool Registry       │       │
│  │           │  │                │  │                       │       │
│  │ WhatsApp  │  │  Bootstrap     │  │  exec     browser     │       │
│  │ Telegram  │  │  Sessions      │  │  search   fetch       │       │
│  │ Discord   │──│  Skills        │──│  cron     canvas      │       │
│  │ Slack     │  │  Turn Loop     │  │  image    process     │       │
│  │ +97 more  │  │  MCP Protocol  │  │  scrape   tts         │       │
│  └───────────┘  └──────┬─────────┘  │  message  rag         │       │
│                        │            └──────────────────────┘       │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                AI Providers (Streaming)                       │  │
│  │  Ollama │ OpenAI │ Anthropic │ OpenRouter │ Gemini │ Bedrock │  │
│  │  DeepSeek │ Vertex │ Cloudflare │ Copilot-Proxy │ +more     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │
│  │ Security  │ │ Dashboard │ │  Media    │ │ Infrastructure     │  │
│  │ Auth      │ │ WebChat   │ │ Pipeline  │ │ ServiceRegistry    │  │
│  │ Profiles  │ │ Status    │ │ Vision    │ │ Config (hot-reload)│  │
│  │ Sandbox   │ │ Canvas    │ │ Audio/TTS │ │ Observability      │  │
│  │ Audit     │ │ Debug     │ │ RAG       │ │ Plugin SDK         │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Install via npm

```bash
npm install -g @coreblow/coreblow
coreblow onboard        # Interactive setup wizard
coreblow gateway start  # Start the gateway
coreblow doctor         # Check system health
```

### From source

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow
pnpm install

# Interactive setup wizard
pnpm tsx src/index.ts onboard

# Start the gateway
pnpm tsx src/index.ts gateway start

# Check system health
pnpm tsx src/index.ts doctor
```

### Docker

```bash
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
| **Slack** | Bot Token | ✅ | ✅ | Ready |
| **iMessage** | BlueBubbles | ✅ | ✅ | Ready |
| **Bluesky** | App Password | — | ✅ | Ready |
| **Matrix** | Access Token | ✅ | ✅ | Ready |
| **WebChat** | Built-in WS | — | — | Ready |

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
| **OpenAI** | Cloud | 💰 | GPT-4o, GPT-4, o1, o3 |
| **Anthropic** | Cloud | 💰 | Claude Opus, Sonnet, Haiku |
| **Google Gemini** | Cloud | 💰 | Gemini 2.5 Pro, Flash |
| **DeepSeek** | Cloud | 💰 | DeepSeek-V3, R1 |
| **Amazon Bedrock** | Cloud | 💰 | All Bedrock models |
| **Anthropic Vertex** | Cloud | 💰 | Claude via Vertex AI |
| **OpenRouter** | Cloud | 💰 | 300+ models via unified API |
| **Cloudflare AI** | Cloud | 💰 | Workers AI models |

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
| `scrape` | Full web scraping via stealth engine (Playwright + stealth) |
| `cron` | Schedule recurring tasks and reminders |
| `message` | Send messages across channels (cross-channel messaging) |
| `image` | Analyze images with vision models |
| `image_gen` | Generate images with DALL-E, Gemini |
| `canvas` | Generate and serve interactive HTML apps |
| `tts` | Text-to-speech with multiple voices |
| `rag` | Retrieval-augmented generation with vector search |
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

## 🧩 Extensions

CoreBlow ships with **101 extensions** — from AI providers to productivity tools:

<details>
<summary><strong>View all extensions</strong></summary>

| Category | Extensions |
|:---|:---|
| **AI Providers** | anthropic, openai-image-gen, openai-whisper, amazon-bedrock, anthropic-vertex, deepseek, gemini, copilot-proxy, cloudflare-ai-gateway, byteplus, chutes |
| **Channels** | discord, slack, bluebubbles, bluesky, imsg, voice-call |
| **Productivity** | apple-notes, apple-reminders, bear-notes, notion, obsidian, things-mac, trello |
| **Search & Web** | brave, xurl, scrape, blogwatcher |
| **Media** | camsnap, peekaboo, video-frames, spotify-player, songsee |
| **DevOps** | github, gh-issues, tmux, coding-agent, database |
| **Smart Home** | openhue, weather |
| **Diagnostics** | diagnostics, diagnostics-otel, healthcheck, model-usage |
| **Infrastructure** | canvas, dashboard, device-pair, bridge, oracle |
| **Audio/TTS** | deepgram, openai-whisper-api, sherpa-onnx-tts |
| **Utility** | 1password, nano-pdf, nano-banana-pro, summarize, skill-creator, skills, session-logs, diffs |

</details>

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
| **Exec sandbox** | Binary policy validation for shell commands |
| **Audit logging** | JSONL audit log with daily rotation |
| **Secret redaction** | API keys hidden in config output |
| **Guardrails** | Toxicity, PII, and bias detection |

---

## 📊 Dashboard

Built-in web dashboard at `http://localhost:3120/dashboard`:

- **System status** — health, uptime, active channels
- **WebChat** — chat with your AI directly from the browser
- **Canvas** — view agent-generated interactive HTML apps
- **Agent management** — sessions, config, debug console
- **Audit log** — view tool executions and auth events
- **Dark theme** — premium glassmorphism design

---

## 🗂️ Project Structure

```
coreblow/
├── src/                       # Single source tree (65 modules)
│   ├── agents/                # Agent engine, turn loop, MCP
│   ├── auth/                  # Authentication & profiles
│   ├── auto-reply/            # Smart reply + model selection
│   ├── canvas/                # Agent-generated HTML apps
│   ├── channels/              # Channel adapters & routing
│   ├── cli/                   # CLI commands & TUI
│   ├── commands/              # Command dispatcher
│   ├── config/                # Zod-validated config system
│   ├── context-engine/        # Context windowing & injection
│   ├── cron/                  # Scheduled tasks & reminders
│   ├── dashboard/             # Web dashboard & WebChat
│   ├── extensions/            # Extension loader & runtime
│   ├── gateway/               # Core HTTP/WS server
│   ├── image-generation/      # Image generation pipeline
│   ├── infra/                 # ServiceRegistry, heartbeat, OOP services
│   ├── logging/               # Structured logging
│   ├── media/                 # Media pipeline (vision, audio)
│   ├── memory/                # Persistent memory engine
│   ├── mcp/                   # Model Context Protocol
│   ├── observability/         # OpenTelemetry integration
│   ├── plugin-sdk/            # Plugin SDK for extension devs
│   ├── plugins/               # Plugin loader & lifecycle
│   ├── providers/             # AI provider adapters
│   ├── rag/                   # Retrieval-augmented generation
│   ├── sandbox/               # Secure execution sandbox
│   ├── security/              # Audit, profiles, guardrails
│   ├── sessions/              # JSONL session management
│   ├── skills/                # Skills system
│   ├── tools/                 # Tool registry & implementations
│   ├── tts/                   # Text-to-speech engine
│   ├── tui/                   # Terminal UI
│   ├── web/                   # Web server infrastructure
│   ├── web-search/            # Web search providers
│   └── ...                    # 30+ more modules
│
├── extensions/                # 101 extension packages
│   ├── anthropic/             # Anthropic provider
│   ├── discord/               # Discord channel
│   ├── brave/                 # Brave search
│   ├── canvas/                # Canvas renderer
│   ├── coding-agent/          # Coding agent
│   ├── notion/                # Notion integration
│   └── ...                    # 95 more extensions
│
├── ultra-skills/              # Web Scraper Engine (Python)
│   ├── scraper/               # Playwright + stealth engine
│   ├── worker/                # Cloudflare Workers API
│   └── dashboard/             # React scraper dashboard
│
├── packages/                  # Shared packages
├── Dockerfile
├── docker-compose.yml
└── coreblow.mjs               # CLI entry point
```

**3,700+ source files · 6,600+ total TypeScript files · 65 modules · 101 extensions · MIT License**

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
pnpm tsx src/index.ts gateway start
```

### Environment Variables

| Variable | Default | Description |
|:---|:---|:---|
| `COREBLOW_HOME` | `~/.coreblow` | Data directory |
| `COREBLOW_PORT` | `3120` | Gateway port |
| `COREBLOW_TOKEN` | — | Auth token |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | Gemini API key |
| `BRAVE_SEARCH_API_KEY` | — | Brave Search key |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama URL |

---

## 🛣️ Roadmap

- [x] Gateway daemon + WebSocket protocol
- [x] 9 AI providers (Ollama, OpenAI, Anthropic, Gemini, DeepSeek, Bedrock, +more)
- [x] 8 channels (WhatsApp, Telegram, Discord, Slack, iMessage, Bluesky, Matrix, WebChat)
- [x] 13+ tools with safety controls
- [x] 101 extensions ecosystem
- [x] Bootstrap files + skills system
- [x] Dashboard with WebChat + Canvas
- [x] Docker deployment
- [x] Plugin SDK
- [x] MCP (Model Context Protocol) support
- [x] RAG (Retrieval-Augmented Generation)
- [x] OOP ServiceRegistry architecture
- [x] Observability (OpenTelemetry)
- [ ] Mobile nodes (iOS/Android)
- [ ] Voice wake + talk mode
- [ ] Marketplace for extensions

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow
pnpm install
pnpm tsx src/index.ts doctor   # Verify setup
pnpm vitest                    # Run tests
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
