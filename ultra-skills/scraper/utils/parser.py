#!/usr/bin/env python3
"""
scraper/utils/parser.py
HTML content parser and data cleaner
"""

import re
import json
from utils.logger import logger

try:
    from selectolax.parser import HTMLParser
    HAS_SELECTOLAX = True
except ImportError:
    HAS_SELECTOLAX = False


class ContentParser:
    """Parse, clean, and structure HTML content."""

    @staticmethod
    def clean_text(text):
        """Remove extra whitespace and normalize text."""
        if not text:
            return ""
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        return text

    @staticmethod
    def extract_text(html):
        """Extract visible text from HTML, removing tags."""
        if not html:
            return ""
        if HAS_SELECTOLAX:
            tree = HTMLParser(html)
            for tag in tree.css('script, style, noscript'):
                tag.decompose()
            text = tree.text(separator=' ')
        else:
            text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
            text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', ' ', text)
        return ContentParser.clean_text(text)

    @staticmethod
    def extract_links(html, base_url=""):
        """Extract all links from HTML."""
        links = []
        pattern = r'<a[^>]+href=["\'](.*?)["\']'
        for match in re.finditer(pattern, html, re.IGNORECASE):
            href = match.group(1)
            if href.startswith('#') or href.startswith('javascript:'):
                continue
            if href.startswith('/') and base_url:
                href = base_url.rstrip('/') + href
            links.append(href)
        return list(set(links))

    @staticmethod
    def extract_images(html, base_url=""):
        """Extract all image URLs from HTML."""
        images = []
        pattern = r'<img[^>]+src=["\'](.*?)["\']'
        for match in re.finditer(pattern, html, re.IGNORECASE):
            src = match.group(1)
            if src.startswith('data:'):
                continue
            if src.startswith('/') and base_url:
                src = base_url.rstrip('/') + src
            images.append(src)
        return list(set(images))

    @staticmethod
    def extract_meta(html):
        """Extract meta tags from HTML."""
        meta = {}
        # Title
        title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
        if title_match:
            meta['title'] = ContentParser.clean_text(title_match.group(1))

        # Meta tags
        for match in re.finditer(
            r'<meta[^>]+(?:name|property)=["\'](.*?)["\'][^>]+content=["\'](.*?)["\']',
            html, re.IGNORECASE
        ):
            meta[match.group(1)] = match.group(2)

        return meta

    @staticmethod
    def extract_structured_data(html):
        """Extract JSON-LD structured data from HTML."""
        results = []
        for match in re.finditer(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL | re.IGNORECASE
        ):
            try:
                data = json.loads(match.group(1))
                results.append(data)
            except json.JSONDecodeError:
                continue
        return results

    @staticmethod
    def sanitize_data(data):
        """Sanitize extracted data — trim strings, remove nulls."""
        if isinstance(data, dict):
            return {k: ContentParser.sanitize_data(v) for k, v in data.items() if v is not None}
        elif isinstance(data, list):
            return [ContentParser.sanitize_data(v) for v in data if v is not None]
        elif isinstance(data, str):
            return ContentParser.clean_text(data)
        return data

    @staticmethod
    def truncate(text, max_length=500):
        """Truncate text to max length with ellipsis."""
        if not text or len(text) <= max_length:
            return text
        return text[:max_length - 3] + "..."
