from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import dateparser
from dateparser.search import search_dates

logger = logging.getLogger(__name__)


PRIORITY_KEYWORDS = {
    "urgent": "urgent",
    "asap": "urgent",
    "high": "high",
    "important": "high",
    "medium": "medium",
    "normal": "medium",
    "low": "low",
}


def parse_natural_language_task(text: str) -> dict:
    """Parse natural language task text into structured data."""
    try:
        lowered = text.lower()
    except AttributeError:
        lowered = ""

    priority = "medium"
    for keyword, mapped in PRIORITY_KEYWORDS.items():
        if keyword in lowered:
            priority = mapped
            break

    due_date: Optional[datetime] = None
    try:
        matches = search_dates(text, settings={"PREFER_DATES_FROM": "future"})
        if matches:
            due_date = matches[0][1]
    except Exception as e:
        logger.warning(f"search_dates failed: {e}")

    if due_date is None:
        try:
            due_date = dateparser.parse(text)
        except Exception as e:
            logger.warning(f"dateparser.parse failed: {e}")

    return {
        "title": text.strip().capitalize() if text else "Untitled Task",
        "description": text.strip() if text else "",
        "priority": priority,
        "due_date": due_date if isinstance(due_date, datetime) else None,
    }
