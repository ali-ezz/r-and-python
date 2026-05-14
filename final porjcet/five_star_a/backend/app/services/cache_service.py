"""Small cache layer backed by Redis with an in-memory fallback.

The app can run without Redis in local development and tests, but when Redis is
available through Docker the same API stores list responses there.
"""

from __future__ import annotations

import fnmatch
import json
import logging
import time
from typing import Any, Optional

from app.config import settings

try:
    import redis
except Exception:  # pragma: no cover - exercised only when package is missing
    redis = None


logger = logging.getLogger(__name__)

_redis_client = None
_memory_cache: dict[str, tuple[Optional[float], str]] = {}
_stats = {
    "hits": 0,
    "misses": 0,
    "sets": 0,
    "deletes": 0,
    "errors": 0,
}


def _client():
    global _redis_client
    if redis is None:
        return None
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
            _redis_client.ping()
        except Exception as exc:
            logger.warning("Redis cache unavailable, using memory fallback: %s", exc)
            _redis_client = False
    return _redis_client if _redis_client is not False else None


def _memory_get(key: str) -> Optional[Any]:
    item = _memory_cache.get(key)
    if not item:
        return None
    expires_at, payload = item
    if expires_at is not None and expires_at < time.time():
        _memory_cache.pop(key, None)
        return None
    return json.loads(payload)


def get_json(key: str) -> Optional[Any]:
    client = _client()
    try:
        if client is not None:
            payload = client.get(key)
            if payload:
                _stats["hits"] += 1
                return json.loads(payload)

        value = _memory_get(key)
        if value is not None:
            _stats["hits"] += 1
            return value

        _stats["misses"] += 1
        return None
    except Exception as exc:
        _stats["errors"] += 1
        logger.warning("Cache read failed for %s: %s", key, exc)
        return None


def set_json(key: str, value: Any, ttl_seconds: int = 120) -> None:
    payload = json.dumps(value, default=str)
    expires_at = time.time() + ttl_seconds if ttl_seconds else None
    _memory_cache[key] = (expires_at, payload)
    _stats["sets"] += 1

    client = _client()
    if client is None:
        return
    try:
        client.setex(key, ttl_seconds, payload)
    except Exception as exc:
        _stats["errors"] += 1
        logger.warning("Cache write failed for %s: %s", key, exc)


def delete_pattern(pattern: str) -> None:
    for key in list(_memory_cache.keys()):
        if fnmatch.fnmatch(key, pattern):
            _memory_cache.pop(key, None)
            _stats["deletes"] += 1

    client = _client()
    if client is None:
        return
    try:
        keys = client.keys(pattern)
        if keys:
            client.delete(*keys)
            _stats["deletes"] += len(keys)
    except Exception as exc:
        _stats["errors"] += 1
        logger.warning("Cache delete failed for %s: %s", pattern, exc)


def clear_domain(domain: str) -> None:
    delete_pattern(f"{domain}:*")


def health() -> dict[str, Any]:
    client = _client()
    redis_up = False
    if client is not None:
        try:
            redis_up = bool(client.ping())
        except Exception:
            redis_up = False
    return {
        "backend": "redis" if redis_up else "memory",
        "redis": "up" if redis_up else "down",
        "memory_entries": len(_memory_cache),
    }


def stats() -> dict[str, Any]:
    total = _stats["hits"] + _stats["misses"]
    hit_ratio = round(_stats["hits"] / total, 4) if total else 0.0
    return {
        **_stats,
        "hit_ratio": hit_ratio,
        **health(),
    }
