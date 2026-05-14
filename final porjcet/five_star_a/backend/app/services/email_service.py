from __future__ import annotations

from typing import Optional


def parse_email_to_task(subject: str, body: Optional[str] = None) -> dict:
    title = subject.strip() or "Task from email"
    description = (body or "").strip()
    return {
        "title": title,
        "description": description,
        "priority": "medium",
    }
