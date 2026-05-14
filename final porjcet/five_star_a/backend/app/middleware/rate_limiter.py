"""Rate limiting middleware using simple in-memory counter."""

from __future__ import annotations

import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Simple in-memory rate limiter: {ip: [(timestamp, count)]}
_rate_limits: dict[str, list[float]] = defaultdict(list)

DEFAULT_RATE_LIMIT = 100  # requests per window
DEFAULT_WINDOW = 60  # seconds


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limit requests by IP address."""

    def __init__(self, app, rate_limit: int = DEFAULT_RATE_LIMIT, window: int = DEFAULT_WINDOW):
        super().__init__(app)
        self.rate_limit = rate_limit
        self.window = window

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Skip rate limiting for health check and docs
        if path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        now = time.time()
        key = f"{client_ip}:{path}"

        # Clean old entries
        _rate_limits[key] = [
            ts for ts in _rate_limits[key] if now - ts < self.window
        ]

        if len(_rate_limits[key]) >= self.rate_limit:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": self.window,
                },
                headers={"Retry-After": str(self.window)},
            )

        _rate_limits[key].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.rate_limit - len(_rate_limits[key]))
        )
        return response
