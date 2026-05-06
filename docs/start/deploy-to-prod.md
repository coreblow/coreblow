# Deploy CoreBlow to Production

A step-by-step guide to self-host CoreBlow as your private AI coding assistant.

## Prerequisites

- **Docker** 24+ and Docker Compose v2 (recommended), OR
- **Node.js** 22+ with pnpm 10+ (bare metal)
- At least one LLM API key (OpenAI, Anthropic, or Google Gemini)

## Option A: Docker (Recommended)

### Step 1: Clone and Configure

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow
cp .env.example .env
```

Edit `.env` with your API keys:

```bash
# Required: at least one provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...

# Gateway security
COREBLOW_GATEWAY_TOKEN=your-secure-token-here

# Network binding
COREBLOW_GATEWAY_BIND=lan        # lan | localhost | 0.0.0.0
COREBLOW_GATEWAY_PORT=3000
```

### Step 2: Build and Start

```bash
# Build the Docker image
docker build -t coreblow:local .

# Start the gateway
docker compose up -d

# Verify it's running
docker compose ps
curl http://localhost:3000/healthz
```

### Step 3: Connect

Connect from the CLI:

```bash
# Interactive mode
docker compose run --rm coreblow-cli

# Or send a one-off message
docker compose run --rm coreblow-cli agent --message "Hello!"
```

Connect from a native app (macOS/iOS/Android):

1. Open the app Settings
2. Set Gateway URL to `ws://your-server-ip:3000`
3. Set Gateway Token to your `COREBLOW_GATEWAY_TOKEN`

## Option B: Bare Metal (Node.js)

### Step 1: Install

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow
pnpm install
```

### Step 2: Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

### Step 3: Start the Gateway

```bash
# Start the gateway server
node coreblow.mjs gateway --bind lan --port 3000
```

### Step 4: Use the CLI

```bash
# In a separate terminal
node coreblow.mjs          # Interactive REPL
node coreblow.mjs tui      # Terminal UI
node coreblow.mjs agent --message "Summarize this repo"
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `COREBLOW_GATEWAY_TOKEN` | — | Auth token for gateway connections |
| `COREBLOW_GATEWAY_PORT` | `3000` | Gateway listen port |
| `COREBLOW_GATEWAY_BIND` | `lan` | Network binding: `lan`, `localhost`, `0.0.0.0` |
| `COREBLOW_CONFIG_DIR` | `~/.coreblow` | Config directory mount |
| `COREBLOW_WORKSPACE_DIR` | `~/.coreblow/workspace` | Workspace mount |
| `COREBLOW_TZ` | `UTC` | Timezone |

### Config File

CoreBlow reads `~/.coreblow/config.json` for persistent settings:

```json
{
  "gateway": {
    "mode": "local",
    "remote": {
      "url": "wss://your-server:3000",
      "token": "your-token"
    }
  }
}
```

## Updating

```bash
# Docker
git pull
docker build -t coreblow:local .
docker compose up -d

# Bare metal
git pull
pnpm install
# Restart the gateway
```

## Troubleshooting

### Gateway won't start
- Check port conflicts: `lsof -i :3000`
- Verify Node.js version: `node --version` (must be 22+)
- Check logs: `docker compose logs coreblow-gateway`

### Can't connect from native app
- Ensure gateway is bound to LAN (`--bind lan` or `COREBLOW_GATEWAY_BIND=lan`)
- Check firewall allows the port
- Verify token matches between server and app

### Health check fails
- Wait 20 seconds for startup (configured `start_period`)
- Check: `curl http://localhost:3000/healthz`

## Security Notes

- Always set `COREBLOW_GATEWAY_TOKEN` in production
- Use `--bind localhost` if gateway should not be network-accessible
- For remote access, use a reverse proxy (nginx/Caddy) with TLS
- Consider Tailscale for zero-config secure networking
