#!/usr/bin/env python3
"""
scraper/pagination.py
Automatic pagination handler for multi-page scraping
"""

import time
from utils.logger import logger


class PaginationHandler:
    """Handle automatic pagination following for scrape targets."""

    def __init__(self, max_pages=10):
        self.max_pages = max_pages

    def paginate(self, page, config, extractor, selectors, selector_type):
        """
        Follow pagination and extract data from each page.

        Args:
            page: Playwright page object
            config: pagination_config dict:
                - next_selector: CSS/XPath for "next" button
                - max_pages: max pages to follow
                - type: 'click' (click next) or 'scroll' (infinite scroll)
                - wait_ms: wait between pages
            extractor: DataExtractor instance
            selectors: extraction selectors
            selector_type: 'css' or 'xpath'

        Returns:
            list of extracted data dicts (one per page)
        """
        if not config:
            return []

        pagination_type = config.get("type", "click")
        max_pages = min(config.get("max_pages", 10), self.max_pages)
        wait_ms = config.get("wait_ms", 2000)

        if pagination_type == "scroll":
            return self._scroll_paginate(page, max_pages, wait_ms, extractor, selectors, selector_type)
        else:
            return self._click_paginate(page, config, max_pages, wait_ms, extractor, selectors, selector_type)

    def _click_paginate(self, page, config, max_pages, wait_ms, extractor, selectors, selector_type):
        """Paginate by clicking a 'next' button."""
        next_selector = config.get("next_selector", "")
        if not next_selector:
            return []

        all_data = []
        page_num = 2  # Page 1 already scraped

        while page_num <= max_pages:
            try:
                # Find next button
                next_btn = page.locator(next_selector)
                if next_btn.count() == 0:
                    logger.info(f"📄 No more pages (next button not found at page {page_num - 1})")
                    break

                # Check if next button is disabled
                is_disabled = next_btn.first.get_attribute("disabled")
                aria_disabled = next_btn.first.get_attribute("aria-disabled")
                classes = next_btn.first.get_attribute("class") or ""

                if is_disabled or aria_disabled == "true" or "disabled" in classes:
                    logger.info(f"📄 Pagination ended (button disabled at page {page_num - 1})")
                    break

                # Click next
                next_btn.first.click()
                page.wait_for_timeout(wait_ms)
                page.wait_for_load_state("networkidle", timeout=10000)

                # Extract data from new page
                extracted = extractor.extract(page, selectors, selector_type)
                if extracted:
                    all_data.append({
                        "page_number": page_num,
                        "data": extracted,
                        "url": page.url,
                    })
                    logger.info(f"📄 Page {page_num}: {len(extracted)} fields extracted")

                page_num += 1

            except Exception as e:
                logger.warning(f"📄 Pagination stopped at page {page_num}: {e}")
                break

        return all_data

    def _scroll_paginate(self, page, max_pages, wait_ms, extractor, selectors, selector_type):
        """Paginate by infinite scrolling."""
        all_data = []
        previous_height = 0
        scroll_count = 0

        while scroll_count < max_pages:
            # Scroll to bottom
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(wait_ms)

            # Check if new content loaded
            current_height = page.evaluate("document.body.scrollHeight")
            if current_height == previous_height:
                logger.info(f"📜 Scroll pagination ended (no new content after scroll {scroll_count + 1})")
                break

            previous_height = current_height
            scroll_count += 1

            # Extract data
            extracted = extractor.extract(page, selectors, selector_type)
            if extracted:
                all_data.append({
                    "page_number": scroll_count + 1,
                    "data": extracted,
                    "url": page.url,
                })

            logger.info(f"📜 Scroll {scroll_count}: page height {current_height}px")

        return all_data
