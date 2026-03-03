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
from change_detector import ChangeDetector
from config import Config
from utils.notifier import Notifier
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
                "name": job_data.get("target_name", ""),
                "url": job_data.get("target_url") or job_data.get("url"),
                "selectors": job_data.get("selectors", "{}"),
                "selector_type": job_data.get("selector_type", "css"),
                "pagination_config": job_data.get("pagination_config"),
                "proxy_required": job_data.get("proxy_required", 0),
                "screenshot_enabled": job_data.get("screenshot_enabled", 0),
                "headers": job_data.get("headers", "{}"),
                "cookies": job_data.get("cookies", "[]"),
                "wait_for_selector": job_data.get("wait_for_selector"),
                "notification_channels": job_data.get("notification_channels"),
                "notify_on_change_only": job_data.get("notify_on_change_only", 0),
                "webhook_url": job_data.get("webhook_url"),
            }

            notifier = Notifier(config.to_dict())
            run_scrape(engine, api, target, job_data, notifier=notifier, dry_run=args.dry_run)


def run_scrape(engine, api, target, job, notifier=None, dry_run=False):
    """Execute a single scrape job with change detection and notifications."""
    job_id = job.get("id")
    started_at = datetime.utcnow().isoformat()
    detector = ChangeDetector()

    # Update job status to running
    if not dry_run and job_id:
        api.update_job(job_id, status="running", started_at=started_at)

    start_time = datetime.utcnow()

    try:
        results = engine.scrape_target(target)
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        for result in results:
            if result.get("status") == "success":
                changes = None

                # Check for changes vs previous scrape
                if not dry_run:
                    previous = api.get_latest_data(target.get("id"))
                    if previous:
                        result["previous_hash"] = previous.get("content_hash")
                        result["has_changes"] = detector.has_changed(
                            result["content_hash"], previous.get("content_hash")
                        )
                        if result["has_changes"]:
                            changes = detector.get_diff(
                                previous.get("extracted_data"),
                                result.get("extracted_data")
                            )
                            logger.info(f"🔔 Changes detected for {target['url']}!")

                    # Store result
                    api.store_data(result)

                # Send notification
                if notifier and not dry_run:
                    notify_change_only = target.get("notify_on_change_only", 0)
                    should_notify = (not notify_change_only) or (result.get("has_changes"))

                    if should_notify:
                        channels = target.get("notification_channels")
                        if isinstance(channels, str):
                            try:
                                channels = json.loads(channels)
                            except Exception:
                                channels = ["telegram"]

                        message = notifier.format_scrape_notification(
                            target.get("name", target["url"]),
                            target["url"],
                            result["status"],
                            result.get("extracted_data"),
                            changes,
                        )
                        notifier.notify(message, channels=channels, data={
                            "url": target["url"],
                            "status": result["status"],
                            "webhook_url": target.get("webhook_url"),
                        })

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
