"""
==========================================================
Main Application
==========================================================

To run this app:
  1. Make sure SQL Server is running
  2. Make sure Redis is running (redis-server)
  3. Run: uvicorn app.main:app --reload
  4. Open: http://localhost:8000/docs

How to test caching:
  1. First, create some products using POST
  2. Call GET /no-cache/products → note the response time
  3. Call GET /cached/products → first call is slow (cache miss)
  4. Call GET /cached/products again → FAST! (cache hit)
  5. Compare the response times!

==========================================================
"""

from fastapi import FastAPI
from database import engine, Base
from redis_client import check_redis
from routers import products_no_cache, products_with_cache

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FastAPI Redis Caching Tutorial",
    description="Learn caching step by step!",
)

# Include routers
app.include_router(products_no_cache.router)
app.include_router(products_with_cache.router)


@app.get("/", tags=["Home"])
def home():
    return {
        "message": "Welcome to the Caching Tutorial!",
        "redis_connected": check_redis(),
        "endpoints": {
            "without_cache": "/no-cache/products",
            "with_cache": "/cached/products",
            "docs": "/docs",
        },
    }


@app.get("/cache/info", tags=["Cache Info"])
def cache_info():
    """
    See what is currently stored in Redis.
    This helps you understand what caching is doing.
    """
    from redis_client import redis_client

    keys = []
    for key in redis_client.scan_iter(match="*"):
        ttl = redis_client.ttl(key)
        keys.append({
            "key": key,
            "ttl_seconds": ttl,
        })

    return {
        "total_cached_keys": len(keys),
        "keys": keys,
    }


@app.delete("/cache/clear", tags=["Cache Info"])
def clear_all_cache():
    """Delete everything from Redis. Fresh start!"""
    from redis_client import redis_client
    redis_client.flushdb()
    return {"message": "All cache cleared!"}