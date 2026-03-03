#!/usr/bin/env python3
"""
scraper/engine.py
Ultra Skills — Core Scraping Engine
CoreBlow Plan 1 · Production-Grade · Playwright + Stealth + Retry
Fase 3: + Proxy Rotation, Pagination, Change Detection
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
from proxy_manager import ProxyManager
from pagination import PaginationHandler
from change_detector import ChangeDetector
from utils.stealth import apply_stealth
from utils.logger import logger


class ScraperEngine:
    """Production-grade scraping engine with stealth, retry, proxy rotation, pagination, and change detection."""

    def __init__(self, config=None):
        self.config = config or {}
        self.extractor = DataExtractor()
        self.ua = UserAgent(browsers=["chrome", "firefox", "edge"])
        self.proxy_manager = ProxyManager(self.config.get("proxy_urls", []))
        self.paginator = PaginationHandler(max_pages=20)
        self.change_detector = ChangeDetector()
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
        start_time = time.time()

        # Get proxy — from target config or proxy pool
        proxy = None
        if target.get("proxy_required"):
            proxy = target.get("proxy") or (
                self.proxy_manager.get_next() if self.proxy_manager.has_proxies else None
            )

        user_agent = self._random_ua()

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
                user_agent=user_agent,
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
                    if proxy:
                        self.proxy_manager.mark_failed(proxy)
                    raise ConnectionError(f"HTTP {response.status if response else 'no response'}")

                # Mark proxy success
                if proxy:
                    self.proxy_manager.mark_success(proxy)

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

                # Change detection
                content_hash = self.change_detector.hash_content(extracted or content)

                # Take screenshot if enabled
                screenshot_path = None
                if target.get("screenshot_enabled"):
                    screenshot_path = f"/tmp/screenshot_{target.get('id', 'unknown')}_{int(time.time())}.png"
                    page.screenshot(path=screenshot_path, full_page=True)

                duration_ms = int((time.time() - start_time) * 1000)

                result = {
                    "target_id": target.get("id"),
                    "url": url,
                    "title": title,
                    "content": content[:50000],
                    "extracted_data": extracted,
                    "metadata": {
                        "status_code": response.status,
                        "scraped_at": datetime.utcnow().isoformat(),
                        "user_agent": user_agent,
                        "proxy_used": proxy,
                        "duration_ms": duration_ms,
                    },
                    "status": "success",
                    "content_hash": content_hash,
                    "screenshot_path": screenshot_path,
                    "page_number": 1,
                }

                results.append(result)
                logger.info(f"✅ Scraped: {url} — {len(extracted)} fields ({duration_ms}ms)")

                # Handle pagination
                pagination_config = self._parse_json(target.get("pagination_config", "null"))
                if pagination_config and selectors:
                    logger.info("📄 Following pagination...")
                    extra_pages = self.paginator.paginate(
                        page, pagination_config, self.extractor, selectors, selector_type
                    )
                    for pg in extra_pages:
                        pg_hash = self.change_detector.hash_content(pg["data"])
                        results.append({
                            "target_id": target.get("id"),
                            "url": pg["url"],
                            "title": title,
                            "extracted_data": pg["data"],
                            "status": "success",
                            "content_hash": pg_hash,
                            "page_number": pg["page_number"],
                        })
                    if extra_pages:
                        logger.info(f"📄 Pagination: {len(extra_pages)} additional pages scraped")

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
