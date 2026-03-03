# Super Scraper v2 — Dashboard Guide

## Overview

The Super Scraper Dashboard is a React-based web interface for managing your scraping targets, monitoring jobs, and exploring collected data.

**Live URL:** `https://super-scraper-dashboard.pages.dev`

## Pages

### Login

Enter your API key to authenticate. The key is validated against the Worker API and stored in `localStorage`.

### Dashboard

Overview page showing:
- **Active Targets** — number of configured scraping targets
- **Total Jobs** — all jobs processed
- **Success Rate** — percentage of successful scrapes
- **Data Records** — total extracted data entries

Quick action buttons for fast navigation.

### Targets

Manage scraping targets:
- **Create** — add URL, CSS selectors, schedule (cron), proxy/screenshot options
- **Edit** — modify any target configuration inline
- **Delete** — remove a target and its associated data
- **Scrape Now** — trigger an immediate scrape job

### Jobs

Monitor the job queue:
- Filter by status: pending, running, success, failed, cancelled
- **Retry** failed jobs
- **Cancel** pending/running jobs
- View duration and timestamps

### Data

Explore scraped data:
- **Search** across all records
- **Detail modal** — view URLs, extracted data (JSON), metadata, content hash
- **Export** data as JSON

### Settings

Configure your instance:
- API connection (Worker URL, API key)
- Notification settings (Telegram, Discord, Webhook)
- Engine defaults (schedule, retries, timeout)
- System info (version, stats)

## Keyboard Shortcuts

- `Ctrl+K` — Focus search (when available)

## Deployment

```bash
cd dashboard
npm run build
wrangler pages deploy dist --project-name=super-scraper-dashboard
```
