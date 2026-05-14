from __future__ import annotations

import logging
import time
from collections import Counter
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("five_star_a.api")
_started_at = time.time()
_metrics_lock = Lock()
_request_metrics = {
	"total_requests": 0,
	"error_requests": 0,
	"total_latency_ms": 0.0,
	"by_method": Counter(),
	"by_status": Counter(),
	"by_path": Counter(),
}


def get_request_metrics() -> dict:
	with _metrics_lock:
		total = int(_request_metrics["total_requests"])
		avg_latency = (
			_request_metrics["total_latency_ms"] / total
			if total
			else 0.0
		)
		return {
			"uptime_seconds": int(time.time() - _started_at),
			"total_requests": total,
			"error_requests": int(_request_metrics["error_requests"]),
			"average_latency_ms": round(avg_latency, 2),
			"by_method": dict(_request_metrics["by_method"]),
			"by_status": dict(_request_metrics["by_status"]),
			"top_paths": dict(_request_metrics["by_path"].most_common(10)),
		}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next) -> Response:
		start = time.perf_counter()
		response = await call_next(request)
		elapsed_ms = (time.perf_counter() - start) * 1000
		with _metrics_lock:
			_request_metrics["total_requests"] += 1
			_request_metrics["total_latency_ms"] += elapsed_ms
			_request_metrics["by_method"][request.method] += 1
			_request_metrics["by_status"][str(response.status_code)] += 1
			_request_metrics["by_path"][request.url.path] += 1
			if response.status_code >= 500:
				_request_metrics["error_requests"] += 1
		logger.info(
			"%s %s %s %.2fms",
			request.method,
			request.url.path,
			response.status_code,
			elapsed_ms,
		)
		return response
