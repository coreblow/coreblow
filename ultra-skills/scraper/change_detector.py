#!/usr/bin/env python3
"""
scraper/change_detector.py
Content change detection using hash comparison
"""

import hashlib
import json
from difflib import unified_diff
from utils.logger import logger


class ChangeDetector:
    """Detect changes between scrape results using content hashing."""

    @staticmethod
    def hash_content(data):
        """Generate MD5 hash of content for comparison."""
        if isinstance(data, dict):
            content = json.dumps(data, sort_keys=True, ensure_ascii=False)
        elif isinstance(data, str):
            content = data
        else:
            content = str(data)
        return hashlib.md5(content.encode()).hexdigest()

    @staticmethod
    def has_changed(new_hash, old_hash):
        """Check if content has changed."""
        if not old_hash:
            return False  # First scrape, no previous data
        return new_hash != old_hash

    @staticmethod
    def get_diff(old_data, new_data):
        """Generate a human-readable diff between old and new data."""
        if isinstance(old_data, dict) and isinstance(new_data, dict):
            changes = {}
            all_keys = set(list(old_data.keys()) + list(new_data.keys()))

            for key in all_keys:
                old_val = old_data.get(key)
                new_val = new_data.get(key)
                if old_val != new_val:
                    changes[key] = {
                        "old": old_val,
                        "new": new_val,
                    }
            return changes

        # String diff
        old_str = str(old_data) if old_data else ""
        new_str = str(new_data) if new_data else ""
        diff = list(unified_diff(
            old_str.splitlines(),
            new_str.splitlines(),
            fromfile="previous",
            tofile="current",
            lineterm="",
        ))
        return "\n".join(diff) if diff else None

    @staticmethod
    def format_change_summary(changes):
        """Format changes into a readable notification message."""
        if isinstance(changes, dict):
            lines = ["📋 **Changes Detected:**"]
            for key, val in changes.items():
                old = str(val.get("old", "—"))[:100]
                new = str(val.get("new", "—"))[:100]
                lines.append(f"• **{key}:** `{old}` → `{new}`")
            return "\n".join(lines)
        elif isinstance(changes, str):
            return f"📋 **Diff:**\n```\n{changes[:500]}\n```"
        return "📋 Content changed (details unavailable)"
