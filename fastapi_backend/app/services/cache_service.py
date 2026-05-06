import json
import fnmatch
import redis.asyncio as redis
from typing import Optional, Any
from loguru import logger
from app.core.config import settings

# Create a global Redis pool
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
_memory_cache: dict[str, str] = {}

class CacheService:
    @staticmethod
    async def get(key: str) -> Optional[Any]:
        if not settings.CACHE_ENABLED:
            value = _memory_cache.get(key)
            return json.loads(value) if value else None

        try:
            value = await redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as exc:
            logger.warning(f"Redis unavailable, falling back to memory cache: {exc}")
            value = _memory_cache.get(key)
            return json.loads(value) if value else None
        return None

    @staticmethod
    async def set(key: str, value: Any, expire: int = 3600):
        payload = json.dumps(value)
        if not settings.CACHE_ENABLED:
            _memory_cache[key] = payload
            return

        try:
            await redis_client.set(key, payload, ex=expire)
        except Exception as exc:
            logger.warning(f"Redis unavailable, writing to memory cache: {exc}")
            _memory_cache[key] = payload

    @staticmethod
    async def delete(key: str):
        _memory_cache.pop(key, None)
        if not settings.CACHE_ENABLED:
            return

        try:
            await redis_client.delete(key)
        except Exception as exc:
            logger.warning(f"Redis unavailable, memory cache only: {exc}")

    @staticmethod
    async def delete_pattern(pattern: str):
        if settings.CACHE_ENABLED:
            try:
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
            except Exception as exc:
                logger.warning(f"Redis unavailable, memory cache only: {exc}")

        for key in list(_memory_cache.keys()):
            if fnmatch.fnmatch(key, pattern):
                _memory_cache.pop(key, None)

async def check_redis_health() -> bool:
    try:
        return await redis_client.ping()
    except Exception:
        return False
