# monitoring.py
# ============================================================
# This file tracks simple numbers (metrics) about our app.
#
# Instead of using a class, we use plain module-level variables.
# A module-level variable is just a variable that lives at the
# top of the file and is shared across all files that import it.
#
# WHAT ARE METRICS?
# Metrics are numbers that increase over time and help you
# understand how your application is performing.
#
# Example:
#   total_requests = 0  → starts at zero
#   total_requests = 1  → someone made a request
#   total_requests = 2  → another request came in
#   ... and so on forever
#
# These numbers answer questions like:
#   "How many notes were created today?"
#   "What percentage of requests are failing?"
#   "How long has the app been running?"
# ============================================================

from datetime import datetime

# ── Uptime Tracking ──────────────────────────────────────────
# Record exactly when the app started so we can calculate uptime
_start_time = datetime.utcnow()

# ── Request Counters ─────────────────────────────────────────
total_requests      = 0   # Every request, no matter the result
successful_requests = 0   # Requests that returned 2xx
failed_requests     = 0   # Requests that returned 4xx or 5xx

# ── Notes Action Counters ────────────────────────────────────
notes_created = 0
notes_updated = 0
notes_deleted = 0

# ── Error Counters ───────────────────────────────────────────
not_found_errors = 0    # 404 errors
server_errors    = 0    # 500 errors


# ── Functions to Update Metrics ──────────────────────────────

def record_request(status_code):
    """
    Call this every time a request finishes.
    Updates the counters based on the response status code.
    """
    global total_requests, successful_requests, failed_requests
    global not_found_errors, server_errors

    total_requests += 1

    if status_code < 400:
        successful_requests += 1
    else:
        failed_requests += 1

    if status_code == 404:
        not_found_errors += 1

    if status_code >= 500:
        server_errors += 1


def note_was_created():
    """Call this every time a note is successfully created."""
    global notes_created
    notes_created += 1


def note_was_updated():
    """Call this every time a note is successfully updated."""
    global notes_updated
    notes_updated += 1


def note_was_deleted():
    """Call this every time a note is successfully deleted."""
    global notes_deleted
    notes_deleted += 1


# ── Functions to Read Metrics ─────────────────────────────────

def get_uptime():
    """
    Returns how long the app has been running.
    Example: "2h 15m 30s"
    """
    now        = datetime.utcnow()
    difference = now - _start_time
    total_secs = int(difference.total_seconds())

    hours   = total_secs // 3600
    minutes = (total_secs % 3600) // 60
    seconds = total_secs % 60

    return f"{hours}h {minutes}m {seconds}s"


def get_error_rate():
    """
    Returns what percentage of requests failed.
    Example: 5.0 means 5% of requests returned an error.
    """
    if total_requests == 0:
        return 0.0
    return round((failed_requests / total_requests) * 100, 2)


def get_summary():
    """
    Returns all metrics in one dictionary.
    Used by the /stats endpoint to show everything at once.
    """
    return {
        "uptime":               get_uptime(),
        "total_requests":       total_requests,
        "successful_requests":  successful_requests,
        "failed_requests":      failed_requests,
        "error_rate_percent":   get_error_rate(),
        "notes_created":        notes_created,
        "notes_updated":        notes_updated,
        "notes_deleted":        notes_deleted,
        "not_found_errors":     not_found_errors,
        "server_errors":        server_errors,
    }