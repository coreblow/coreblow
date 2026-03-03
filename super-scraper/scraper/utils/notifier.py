#!/usr/bin/env python3
"""
scraper/utils/notifier.py
Multi-channel notification system — Telegram, Discord, Webhook
"""

import json
import requests
from utils.logger import logger


class Notifier:
    """Send notifications to multiple channels."""

    def __init__(self, config):
        self.telegram_token = config.get("telegram_token", "")
        self.telegram_chat_id = config.get("telegram_chat_id", "")
        self.discord_webhook = config.get("discord_webhook", "")

    def notify(self, message, channels=None, data=None):
        """Send notification to specified channels."""
        channels = channels or ["telegram"]
        results = {}

        for channel in channels:
            try:
                if channel == "telegram" and self.telegram_token:
                    results["telegram"] = self._send_telegram(message)
                elif channel == "discord" and self.discord_webhook:
                    results["discord"] = self._send_discord(message, data)
                elif channel == "webhook" and data and data.get("webhook_url"):
                    results["webhook"] = self._send_webhook(data["webhook_url"], message, data)
            except Exception as e:
                logger.error(f"Notification failed [{channel}]: {e}")
                results[channel] = {"success": False, "error": str(e)}

        return results

    def _send_telegram(self, message):
        """Send Telegram message via Bot API."""
        url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
        payload = {
            "chat_id": self.telegram_chat_id,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }
        res = requests.post(url, json=payload, timeout=10)
        result = res.json()
        if result.get("ok"):
            logger.info("📨 Telegram notification sent")
            return {"success": True}
        else:
            logger.error(f"Telegram error: {result}")
            return {"success": False, "error": result.get("description", "Unknown")}

    def _send_discord(self, message, data=None):
        """Send Discord message via Webhook."""
        embed = {
            "title": "🕷️ Super Scraper Alert",
            "description": message[:2000],
            "color": 0x818cf8,
            "footer": {"text": "CoreBlow Super Scraper"},
        }

        if data and data.get("url"):
            embed["url"] = data["url"]
            embed["fields"] = [
                {"name": "URL", "value": data["url"], "inline": True},
                {"name": "Status", "value": data.get("status", "—"), "inline": True},
            ]

        payload = {"embeds": [embed]}
        res = requests.post(self.discord_webhook, json=payload, timeout=10)

        if res.status_code in (200, 204):
            logger.info("📨 Discord notification sent")
            return {"success": True}
        else:
            logger.error(f"Discord error: {res.status_code}")
            return {"success": False, "error": f"HTTP {res.status_code}"}

    def _send_webhook(self, url, message, data=None):
        """Send POST to custom webhook URL."""
        payload = {
            "event": "scrape_complete",
            "message": message,
            "data": data,
            "source": "coreblow-super-scraper",
        }
        res = requests.post(url, json=payload, timeout=10)
        success = res.status_code < 400

        if success:
            logger.info(f"📨 Webhook sent to {url[:40]}...")
        else:
            logger.error(f"Webhook failed: HTTP {res.status_code}")

        return {"success": success, "status_code": res.status_code}

    def format_scrape_notification(self, target_name, url, status, extracted=None, changes=None):
        """Format a standard scrape result notification."""
        emoji = "✅" if status == "success" else "❌"
        lines = [
            f"{emoji} *Scrape Complete*",
            f"📌 *Target:* {target_name}",
            f"🔗 *URL:* {url}",
            f"📊 *Status:* {status}",
        ]

        if extracted:
            fields = len(extracted) if isinstance(extracted, dict) else 0
            lines.append(f"📋 *Fields extracted:* {fields}")

        if changes:
            lines.append(f"🔔 *Changes detected!*")
            if isinstance(changes, dict):
                for k, v in list(changes.items())[:3]:
                    lines.append(f"  • {k}: `{str(v.get('new', ''))[:50]}`")

        lines.append(f"\n_CoreBlow Super Scraper v2_")
        return "\n".join(lines)
