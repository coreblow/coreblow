#!/usr/bin/env python3
"""
scraper/extractor.py
CSS Selector & XPath data extraction engine
"""

import json
from utils.logger import logger


class DataExtractor:
    """Extract structured data from pages using CSS selectors or XPath."""

    def extract(self, page, selectors, selector_type="css"):
        """
        Extract data from a page based on selector configuration.

        Args:
            page: Playwright page object
            selectors: dict of {field_name: selector_string}
                       or {field_name: {selector, attribute, multiple}}
            selector_type: 'css' or 'xpath'

        Returns:
            dict of {field_name: extracted_value}
        """
        if not selectors:
            return {}

        results = {}

        for field_name, selector_config in selectors.items():
            try:
                # Support both simple string selectors and config objects
                if isinstance(selector_config, str):
                    selector = selector_config
                    attribute = None
                    multiple = False
                elif isinstance(selector_config, dict):
                    selector = selector_config.get("selector", selector_config.get("s", ""))
                    attribute = selector_config.get("attribute", selector_config.get("attr"))
                    multiple = selector_config.get("multiple", selector_config.get("multi", False))
                else:
                    continue

                if not selector:
                    continue

                if multiple:
                    results[field_name] = self._extract_multiple(
                        page, selector, selector_type, attribute
                    )
                else:
                    results[field_name] = self._extract_single(
                        page, selector, selector_type, attribute
                    )

            except Exception as e:
                logger.warning(f"Extraction failed for '{field_name}': {e}")
                results[field_name] = None

        return results

    def _extract_single(self, page, selector, selector_type, attribute=None):
        """Extract a single value."""
        try:
            if selector_type == "xpath":
                element = page.locator(f"xpath={selector}").first
            else:
                element = page.locator(selector).first

            if not element:
                return None

            if attribute:
                return element.get_attribute(attribute)
            return element.inner_text().strip()

        except Exception:
            return None

    def _extract_multiple(self, page, selector, selector_type, attribute=None):
        """Extract multiple values as a list."""
        try:
            if selector_type == "xpath":
                elements = page.locator(f"xpath={selector}")
            else:
                elements = page.locator(selector)

            count = elements.count()
            results = []

            for i in range(min(count, 100)):  # Cap at 100 elements
                el = elements.nth(i)
                if attribute:
                    val = el.get_attribute(attribute)
                else:
                    val = el.inner_text().strip()
                if val:
                    results.append(val)

            return results

        except Exception:
            return []

    def extract_table(self, page, table_selector, selector_type="css"):
        """Extract data from an HTML table into list of dicts."""
        try:
            if selector_type == "xpath":
                table = page.locator(f"xpath={table_selector}")
            else:
                table = page.locator(table_selector)

            # Get headers
            headers = []
            header_els = table.locator("thead th, thead td")
            for i in range(header_els.count()):
                headers.append(header_els.nth(i).inner_text().strip())

            if not headers:
                # Try first row as headers
                first_row = table.locator("tr").first
                cells = first_row.locator("th, td")
                for i in range(cells.count()):
                    headers.append(cells.nth(i).inner_text().strip())

            # Get rows
            rows = []
            row_els = table.locator("tbody tr")
            for i in range(min(row_els.count(), 500)):  # Cap at 500 rows
                row = {}
                cells = row_els.nth(i).locator("td")
                for j in range(min(cells.count(), len(headers))):
                    row[headers[j]] = cells.nth(j).inner_text().strip()
                if row:
                    rows.append(row)

            return rows

        except Exception as e:
            logger.error(f"Table extraction failed: {e}")
            return []
