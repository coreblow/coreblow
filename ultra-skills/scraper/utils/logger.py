#!/usr/bin/env python3
"""
scraper/utils/logger.py
Structured logging for Ultra Skills
"""

import logging
import sys
from datetime import datetime


class ColorFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[41m",
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        return f"{color}[{timestamp}] [{record.levelname:8s}]{self.RESET} {record.getMessage()}"


# Configure logger
logger = logging.getLogger("ultra-skills")
logger.setLevel(logging.DEBUG)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(ColorFormatter())
logger.addHandler(handler)
