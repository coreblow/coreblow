# Ultra Skills v2 — Setup Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- GitHub account
- Cloudflare account (free tier)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/coreblow/coreblow.git
cd coreblow/ultra-skills
```

### 2. Setup Cloudflare

```bash
# Install Wrangler CLI
npm install -g wrangler
wrangler login

# Create D1 database
wrangler d1 create ultra-skills-db

# Initialize schema
wrangler d1 execute ultra-skills-db --file=database/schema.sql

# Deploy Worker
cd worker
npm install
wrangler deploy
```

### 3. Configure API Key

```bash
# Set master key
wrangler secret put MASTER_API_KEY

# Generate admin API key
curl -X POST https://your-worker.workers.dev/api/auth/setup \
  -H "X-Master-Key: YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Admin"}'
```

### 4. Setup Python Engine

```bash
cd ../scraper
pip install -r requirements.txt
playwright install chromium
```

### 5. Configure Environment

```bash
cp ../.env.example ../.env
# Edit .env with your Worker URL and API key
```

### 6. Test Scrape

```bash
python main.py --url "https://example.com" --selectors '{"title": "h1"}'
```

### 7. Deploy Dashboard

```bash
cd ../dashboard
npm install
npm run build
wrangler pages project create ultra-skills-dashboard
wrangler pages deploy dist --project-name=ultra-skills-dashboard
```

### 8. GitHub Secrets

Set these in your repo Settings > Secrets:

| Secret | Value |
|:---|:---|
| `WORKER_URL` | Your Cloudflare Worker URL |
| `WORKER_API_KEY` | Generated API key |
| `TELEGRAM_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your chat/group ID |
| `DISCORD_WEBHOOK` | Discord webhook URL (optional) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (for auto-deploy) |

## Environment Variables

See `.env.example` for all available configuration options.
