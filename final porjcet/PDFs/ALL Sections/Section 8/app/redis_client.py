"""
==========================================================
Redis Connection
==========================================================

What is Redis?
    Redis is like a Python dictionary, but it runs as
    a separate server and stores data in RAM (memory).

    Python dict  →  my_dict["name"] = "Ahmed"
    Redis        →  redis.set("name", "Ahmed")

Why is it fast?
    Data lives in RAM, not on disk like a database.

Why not just use a Python dict?
    - A Python dict dies when your app restarts
    - Redis keeps data even if your app restarts
    - Redis can be shared between multiple app instances

What is Caching?
    Saving the result of an expensive operation so you
    don't have to repeat it. Like taking a photo of a
    whiteboard instead of copying it by hand every time.

    Without cache:
        User Request → Query Database (slow) → Return

    With cache:
        User Request → Check Redis (fast) → Return
        (only query the database if Redis doesn't have it)

==========================================================
"""

import redis

# Connect to Redis server (make sure Redis is running!)
redis_client = redis.Redis(
    host="localhost",
    port=6379,
    db=0,
    decode_responses=True  # So we get strings, not bytes
)


def check_redis():
    """Check if Redis server is running."""
    try:
        redis_client.ping()
        return True
    except redis.ConnectionError:
        return False