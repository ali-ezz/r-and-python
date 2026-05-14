from __future__ import annotations

from urllib.parse import quote


def paginate(skip: int = 0, limit: int = 50) -> tuple[int, int]:
    safe_skip = max(skip, 0)
    safe_limit = max(min(limit, 200), 1)
    return safe_skip, safe_limit


def build_avatar_url(filename: str) -> str:
    return f"/static/avatars/{quote(filename)}"
