#!/usr/bin/env python3
"""
scraper/main.py
Super Scraper v2 — Main Entry Point
Reads targets from Worker API → Scrapes → Posts results back

Usage:
  python main.py                     # Scrape all pending jobs
  python main.py --target-id 1       # Scrape specific target
  python main.py --url https://x.com # Quick one-off scrape
"""

import os
import sys
import json
import argparse
import requests
from datetime import datetime

from engine import ScraperEngine
from config import Config
from utils.logger import logger


def main():
    parser = argparse.ArgumentParser(description="Super Scraper v2 — CoreBlow")
    parser.add_argument("--target-id", type=int, help="Scrape specific target by ID")
    parser.add_argument("--url", type=str, help="Quick scrape a URL")
    parser.add_argument("--selectors", type=str, help="JSON selectors for --url mode")
    parser.add_argument("--dry-run", action="store_true", help="Don't post results to API")
    args = parser.parse_args()

    config = Config()
    engine = ScraperEngine(config=config.to_dict())

    if args.url:
        # Quick one-off scrape mode
        logger.info(f"🕷️ Quick scrape: {args.url}")
        target = {
            "url": args.url,
            "selectors": json.loads(args.selectors) if args.selectors else {},
            "selector_type": "css",
        }
        results = engine.scrape_target(target)
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return

    # API-driven mode
    api = ApiClient(config)

    if args.target_id:
        # Scrape specific target
        logger.info(f"🎯 Scraping target #{args.target_id}")
        target = api.get_target(args.target_id)
        if not target:
            logger.error(f"Target #{args.target_id} not found")
            sys.exit(1)

        job = api.create_job(target_id=args.target_id)
        run_scrape(engine, api, target, job, dry_run=args.dry_run)
    else:
        # Scrape all pending jobs
        logger.info("📋 Fetching pending jobs...")
        pending = api.get_pending_jobs()

        if not pending:
            logger.info("✅ No pending jobs. All done!")
            return

        logger.info(f"🔄 Processing {len(pending)} pending jobs...")

        for job_data in pending:
            target = {
                "id": job_data.get("target_id"),
                "url": job_data.get("target_url") or job_data.get("url"),
                "selectors": job_data.get("selectors", "{}"),
                "selector_type": job_data.get("selector_type", "css"),
                "proxy_required": job_data.get("proxy_required", 0),
                "screenshot_enabled": job_data.get("screenshot_enabled", 0),
                "headers": job_data.get("headers", "{}"),
                "cookies": job_data.get("cookies", "[]"),
                "wait_for_selector": job_data.get("wait_for_selector"),
            }
            run_scrape(engine, api, target, job_data, dry_run=args.dry_run)


def run_scrape(engine, api, target, job, dry_run=False):
    """Execute a single scrape job."""
    job_id = job.get("id")
    started_at = datetime.utcnow().isoformat()

    # Update job status to running
    if not dry_run and job_id:
        api.update_job(job_id, status="running", started_at=started_at)

    start_time = datetime.utcnow()

    try:
        results = engine.scrape_target(target)
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        for result in results:
            if result.get("status") == "success":
                # Check for changes vs previous scrape
                if not dry_run:
                    previous = api.get_latest_data(target.get("id"))
                    if previous:
                        result["previous_hash"] = previous.get("content_hash")
                        result["has_changes"] = result["content_hash"] != previous.get("content_hash")

                    # Store result
                    api.store_data(result)

                logger.info(f"✅ Success: {target['url']} ({duration_ms}ms)")
            else:
                logger.error(f"❌ Failed: {target['url']}")

        # Update job status
        if not dry_run and job_id:
            status = "success" if any(r["status"] == "success" for r in results) else "failed"
            api.update_job(
                job_id,
                status=status,
                completed_at=datetime.utcnow().isoformat(),
                duration_ms=duration_ms,
            )

    except Exception as e:
        logger.error(f"💥 Job failed: {e}")
        if not dry_run and job_id:
            api.update_job(
                job_id,
                status="failed",
                completed_at=datetime.utcnow().isoformat(),
                error_message=str(e),
            )


class ApiClient:
    """HTTP client for Super Scraper Worker API."""

    def __init__(self, config):
        self.base_url = config.worker_url.rstrip("/")
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": config.api_key,
        }

    def get_target(self, target_id):
        r = requests.get(f"{self.base_url}/api/targets/{target_id}", headers=self.headers)
        data = r.json()
        return data.get("data") if data.get("success") else None

    def get_pending_jobs(self):
        r = requests.get(f"{self.base_url}/api/jobs/pending", headers=self.headers)
        data = r.json()
        return data.get("data", [])

    def create_job(self, target_id=None, url=None):
        payload = {}
        if target_id:
            payload["target_id"] = target_id
        if url:
            payload["url"] = url
        r = requests.post(f"{self.base_url}/api/jobs", headers=self.headers, json=payload)
        return r.json()

    def update_job(self, job_id, **kwargs):
        requests.put(f"{self.base_url}/api/jobs/{job_id}", headers=self.headers, json=kwargs)

    def store_data(self, result):
        requests.post(f"{self.base_url}/api/data", headers=self.headers, json=result)

    def get_latest_data(self, target_id):
        if not target_id:
            return None
        r = requests.get(
            f"{self.base_url}/api/data?target_id={target_id}&limit=1",
            headers=self.headers,
        )
        data = r.json()
        items = data.get("data", [])
        return items[0] if items else None


if __name__ == "__main__":
    main()
