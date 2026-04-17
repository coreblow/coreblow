#!/usr/bin/env python3
"""
scraper/proxy_manager.py
Proxy rotation pool with health tracking
"""

import random
import time
from utils.logger import logger


class ProxyManager:
    """Manage and rotate through a pool of proxy servers."""

    def __init__(self, proxy_urls=None):
        self.proxies = []
        if proxy_urls:
            for url in proxy_urls:
                url = url.strip()
                if url:
                    self.proxies.append({
                        "url": url,
                        "failures": 0,
                        "last_used": 0,
                        "total_requests": 0,
                        "active": True,
                    })

        if self.proxies:
            logger.info(f"🔄 Proxy pool initialized: {len(self.proxies)} proxies")

    def get_next(self):
        """Get the next available proxy using weighted round-robin."""
        active = [p for p in self.proxies if p["active"]]
        if not active:
            return None

        # Sort by least recently used, then fewest failures
        active.sort(key=lambda p: (p["last_used"], p["failures"]))
        proxy = active[0]
        proxy["last_used"] = time.time()
        proxy["total_requests"] += 1

        logger.debug(f"Using proxy: {proxy['url'][:30]}...")
        return proxy["url"]

    def get_random(self):
        """Get a random active proxy."""
        active = [p for p in self.proxies if p["active"]]
        if not active:
            return None
        proxy = random.choice(active)
        proxy["last_used"] = time.time()
        proxy["total_requests"] += 1
        return proxy["url"]

    def mark_failed(self, proxy_url):
        """Mark proxy as failed. Disable after 5 failures."""
        for p in self.proxies:
            if p["url"] == proxy_url:
                p["failures"] += 1
                if p["failures"] >= 5:
                    p["active"] = False
                    logger.warning(f"❌ Proxy disabled (5 failures): {proxy_url[:30]}...")
                break

    def mark_success(self, proxy_url):
        """Reset failure counter on success."""
        for p in self.proxies:
            if p["url"] == proxy_url:
                p["failures"] = max(0, p["failures"] - 1)
                break

    def get_stats(self):
        """Get proxy pool statistics."""
        return {
            "total": len(self.proxies),
            "active": sum(1 for p in self.proxies if p["active"]),
            "disabled": sum(1 for p in self.proxies if not p["active"]),
            "proxies": [
                {
                    "url": p["url"][:30] + "...",
                    "active": p["active"],
                    "failures": p["failures"],
                    "requests": p["total_requests"],
                }
                for p in self.proxies
            ],
        }

    @property
    def has_proxies(self):
        return len([p for p in self.proxies if p["active"]]) > 0
