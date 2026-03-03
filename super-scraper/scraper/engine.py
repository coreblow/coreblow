#!/usr/bin/env python3
"""
scraper/engine.py
Super Scraper v2 — Core Scraping Engine
CoreBlow Plan 1 · Production-Grade · Playwright + Stealth + Retry
"""

import os
import json
import hashlib
import time
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from fake_useragent import UserAgent

from extractor import DataExtractor
from utils.stealth import apply_stealth
from utils.logger import logger


class ScraperEngine:
    """Production-grade scraping engine with stealth, retry, and multi-target support."""

    def __init__(self, config=None):
        self.config = config or {}
        self.extractor = DataExtractor()
        self.ua = UserAgent(browsers=["chrome", "firefox", "edge"])
        self.results = []

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type((PlaywrightTimeout, ConnectionError)),
        before_sleep=lambda rs: logger.warning(f"Retry attempt {rs.attempt_number}"),
    )
    def scrape_target(self, target):
        """Scrape a single target with full configuration."""
        results = []
        proxy = target.get("proxy") if target.get("proxy_required") else None

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                    "--disable-dev-shm-usage",
                ],
            )

            context = browser.new_context(
                user_agent=self._random_ua(),
                viewport={"width": 1920, "height": 1080},
                locale="en-US",
                timezone_id="America/New_York",
                proxy={"server": proxy} if proxy else None,
                extra_http_headers=self._parse_json(target.get("headers", "{}")),
            )

            # Apply stealth patches
            apply_stealth(context)

            # Set cookies if provided
            cookies = self._parse_json(target.get("cookies", "[]"))
            if cookies and isinstance(cookies, list):
                context.add_cookies(cookies)

            page = context.new_page()
            page.set_default_timeout(30000)

            try:
                url = target["url"]
                logger.info(f"Scraping: {url}")

                # Navigate
                response = page.goto(url, wait_until="networkidle", timeout=30000)

                if not response or response.status >= 400:
                    raise ConnectionError(f"HTTP {response.status if response else 'no response'}")

                # Wait for specific selector if configured
                wait_selector = target.get("wait_for_selector")
                if wait_selector:
                    page.wait_for_selector(wait_selector, timeout=10000)

                # Small random delay to look human
                page.wait_for_timeout(1000 + int(time.time() * 1000) % 2000)

                # Extract data
                selectors = self._parse_json(target.get("selectors", "{}"))
                selector_type = target.get("selector_type", "css")

                extracted = {}
                if selectors:
                    extracted = self.extractor.extract(page, selectors, selector_type)

                # Get page content
                title = page.title()
                content = page.content()

                # Generate content hash for change detection
                content_hash = hashlib.md5(
                    json.dumps(extracted or content, sort_keys=True).encode()
                ).hexdigest()

                # Take screenshot if enabled
                screenshot_path = None
                if target.get("screenshot_enabled"):
                    screenshot_path = f"/tmp/screenshot_{target.get('id', 'unknown')}_{int(time.time())}.png"
                    page.screenshot(path=screenshot_path, full_page=True)

                result = {
                    "target_id": target.get("id"),
                    "url": url,
                    "title": title,
                    "content": content[:50000],  # Limit content size
                    "extracted_data": extracted,
                    "metadata": {
                        "status_code": response.status,
                        "scraped_at": datetime.utcnow().isoformat(),
                        "user_agent": context._options.get("user_agent", ""),
                        "proxy_used": proxy,
                        "duration_ms": int(time.time() * 1000) % 100000,
                    },
                    "status": "success",
                    "content_hash": content_hash,
                    "screenshot_path": screenshot_path,
                    "page_number": 1,
                }

                results.append(result)
                logger.info(f"✅ Scraped: {url} — {len(extracted)} fields extracted")

            except PlaywrightTimeout as e:
                logger.error(f"Timeout scraping {target['url']}: {e}")
                raise
            except Exception as e:
                logger.error(f"Error scraping {target['url']}: {e}")
                results.append({
                    "target_id": target.get("id"),
                    "url": target["url"],
                    "status": "failed",
                    "metadata": {"error": str(e)},
                    "content_hash": None,
                })
            finally:
                browser.close()

        return results

    def scrape_batch(self, targets):
        """Scrape multiple targets sequentially."""
        all_results = []
        for target in targets:
            try:
                results = self.scrape_target(target)
                all_results.extend(results)
            except Exception as e:
                logger.error(f"Failed to scrape {target.get('url', 'unknown')}: {e}")
                all_results.append({
                    "target_id": target.get("id"),
                    "url": target.get("url", "unknown"),
                    "status": "failed",
                    "metadata": {"error": str(e), "max_retries_exceeded": True},
                    "content_hash": None,
                })
        return all_results

    def _random_ua(self):
        """Generate random user agent."""
        try:
            return self.ua.random
        except Exception:
            return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    def _parse_json(self, value):
        """Safe JSON parse."""
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}
