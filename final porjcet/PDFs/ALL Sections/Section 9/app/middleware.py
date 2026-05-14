# middleware.py
# ============================================================
# This file logs every request and response automatically.
#
# WHAT IS MIDDLEWARE?
# Middleware is a function that runs BEFORE every request
# reaches its route and AFTER every response leaves.
#
# WHY IS THIS USEFUL FOR LOGGING?
# Instead of adding log lines to every single route manually,
# we log ONCE here and it covers ALL routes automatically.
#
# ANALOGY:
# Think of a security guard at a building entrance.
# The guard records every person coming IN and going OUT,
# without the people inside doing anything.
#
# ⚠️ NOTE ABOUT "async":
# This is the ONE function in the project that uses async.
# FastAPI's HTTP middleware system requires it.
# You do not need to fully understand async right now —
# just know that all your route functions stay as regular def.
# This is a FastAPI requirement, not our choice.
# ============================================================

import time
import uuid
import logging
from fastapi import Request
import monitoring

logger = logging.getLogger("notes_api.middleware")


async def log_requests(request: Request, call_next):
    """
    Runs for EVERY incoming request automatically.
    Logs the request when it arrives and the response when it leaves.
    """

    # ── When the request ARRIVES ─────────────────────────────

    # Generate a short unique ID for this request
    # This connects the "arrived" log with the "completed" log
    # Example: [a3f2b1c8] --> GET /notes
    #          [a3f2b1c8] <-- GET /notes | Status: 200
    request_id = str(uuid.uuid4())[:8]

    start_time = time.time()
    method     = request.method
    path       = request.url.path
    client_ip  = request.client.host if request.client else "unknown"

    logger.info(
        f"[{request_id}] --> {method} {path} | IP: {client_ip}"
    )

    # ── Pass the request to the actual route ─────────────────
    try:
        response = await call_next(request)

    except Exception as error:
        # The route crashed completely (unhandled exception)
        duration = round(time.time() - start_time, 3)

        logger.error(
            f"[{request_id}] CRASHED {method} {path} | "
            f"Error: {str(error)} | Duration: {duration}s",
            exc_info=True   # Adds full traceback to the log
        )
        monitoring.record_request(500)
        raise   # Let FastAPI handle it from here

    # ── When the response is READY ───────────────────────────

    duration    = round(time.time() - start_time, 3)
    status_code = response.status_code

    # Record this request in our metrics
    monitoring.record_request(status_code)

    # Choose log level based on status code:
    #   200–399 → INFO    (success)
    #   400–499 → WARNING (client error, e.g. note not found)
    #   500+    → ERROR   (server error, something broke)
    log_line = (
        f"[{request_id}] <-- {method} {path} | "
        f"Status: {status_code} | Duration: {duration}s"
    )

    if status_code >= 500:
        logger.error(log_line)
    elif status_code >= 400:
        logger.warning(log_line)
    else:
        logger.info(log_line)

    # Add the request ID to the response headers
    # Users can report this ID when they encounter issues
    response.headers["X-Request-ID"] = request_id

    return response