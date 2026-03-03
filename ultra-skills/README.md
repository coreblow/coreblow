# 🕷️ Ultra Skills v2.0

### Production-Grade Web Scraping Engine by CoreBlow

> **Plan 1** of the CoreBlow AIGateway Blueprint  
> Dual-Mode: Standalone + AIGateway Embedded  
> License: ELv2 (Elastic License v2)

---

## ⚡ Features

- **🎭 Stealth Mode** — Custom anti-detection patches (webdriver, fingerprint, WebGL)
- **🔄 Auto-Retry** — Tenacity-based retry with exponential backoff
- **🎯 CSS/XPath Extraction** — Extract structured data with selectors
- **📊 Change Detection** — MD5 hash comparison vs previous scrape
- **📸 Screenshot Capture** — Full-page screenshots stored in R2
- **🔌 REST API** — Cloudflare Worker with JWT + API Key auth
- **⏰ Scheduled Scraping** — GitHub Actions cron (every 6 hours)
- **📈 Rate Limiting** — IP-based sliding window
- **📤 Export** — CSV and JSON data export
- **🔐 Audit Logging** — Full action history

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  GitHub Actions      │────▶│ Python + Playwright│────▶│ Cloudflare    │
│  (Cron Scheduler)   │     │ (Scraper Engine)  │     │ Worker API    │
└─────────────────────┘     └──────────────────┘     │ D1 Database   │
                                                      │ R2 Storage    │
┌─────────────────────┐                               └───────────────┘
│  Dashboard (React)  │─────────────────────────────────────▲
│  Cloudflare Pages   │                                     │
└─────────────────────┘                                REST API
```

## 🚀 Quick Start

### 1. Deploy Worker API

```bash
cd worker
npm install
# Edit wrangler.toml with your D1 database ID
npm run db:init
npm run deploy
```

### 2. Setup Initial API Key

```bash
curl -X POST https://YOUR-WORKER.workers.dev/api/auth/setup \
  -H "X-Master-Key: YOUR_MASTER_KEY" \
  -H "Content-Type: application/json"
```

### 3. Add a Scrape Target

```bash
curl -X POST https://YOUR-WORKER.workers.dev/api/targets \
  -H "X-API-Key: ss_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Site",
    "url": "https://example.com",
    "selectors": {"title": "h1", "content": "p"},
    "schedule": "0 */6 * * *"
  }'
```

### 4. Run Scraper Locally

```bash
cd scraper
pip install -r requirements.txt
python -m playwright install chromium

# Quick scrape
python main.py --url https://example.com

# Scrape specific target
python main.py --target-id 1
```

## 📁 Project Structure

```
ultra-skills/
├── .github/workflows/scrape.yml    # GitHub Actions cron
├── database/schema.sql             # D1 schema (6 tables)
├── worker/
│   ├── src/
│   │   ├── index.js                # API router
│   │   ├── routes/                 # targets, data, jobs, auth, export
│   │   ├── middleware/             # auth, rateLimit
│   │   └── utils/                  # response helpers
│   └── wrangler.toml
├── scraper/
│   ├── main.py                     # Entry point
│   ├── engine.py                   # Core scraping engine
│   ├── extractor.py                # CSS/XPath extraction
│   ├── config.py                   # Environment config
│   └── utils/
│       ├── stealth.py              # Anti-detection patches
│       └── logger.py               # Structured logging
└── .env.example
```

## 🔗 API Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Dashboard statistics |
| CRUD | `/api/targets` | Manage scrape targets |
| CRUD | `/api/data` | Access scraped data |
| CRUD | `/api/jobs` | Job queue management |
| GET | `/api/jobs/pending` | Pending jobs for runner |
| GET | `/api/export` | Export data (CSV/JSON) |
| POST | `/api/auth/setup` | Initial API key setup |
| POST | `/api/auth/keys` | Create API keys |

---

**CoreBlow** — Autonomous AI agents that run anywhere, powered by any model, fully under your control.
