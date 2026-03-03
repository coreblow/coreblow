#!/usr/bin/env python3
"""
scraper/config.py
Configuration loader for Ultra Skills
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Load configuration from environment variables."""

    def __init__(self):
        self.worker_url = os.getenv("WORKER_URL", "http://localhost:8787")
        self.api_key = os.getenv("WORKER_API_KEY", "")

        # Telegram
        self.telegram_token = os.getenv("TELEGRAM_TOKEN", "")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")

        # Discord
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK", "")

        # Proxy
        self.proxy_urls = [
            p.strip()
            for p in os.getenv("PROXY_URLS", "").split(",")
            if p.strip()
        ]

        # Engine
        self.headless = os.getenv("HEADLESS", "true").lower() == "true"
        self.timeout = int(os.getenv("SCRAPE_TIMEOUT", "30000"))
        self.max_retries = int(os.getenv("MAX_RETRIES", "3"))

    def to_dict(self):
        return {
            "worker_url": self.worker_url,
            "api_key": self.api_key,
            "headless": self.headless,
            "timeout": self.timeout,
            "max_retries": self.max_retries,
            "proxy_urls": self.proxy_urls,
            "telegram_token": self.telegram_token,
            "telegram_chat_id": self.telegram_chat_id,
            "discord_webhook": self.discord_webhook,
        }
