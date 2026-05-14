# routers/health.py
# ============================================================
# Two special routes that are about the application itself:
#
#   GET /health  → Is the app alive? Is the database reachable?
#   GET /stats   → What are the current metrics of the app?
#
# WHY /health?
# In production, external tools call /health every few seconds
# to verify the app is still running properly.
# If it returns an error, they trigger an alert.
#
# WHY /stats?
# This is our simple monitoring dashboard.
# Instead of a real dashboard tool, we expose the numbers
# as a JSON endpoint so we can see what the app is doing.
#
# ANALOGY:
# /health = "Are you okay?" (quick yes or no)
# /stats  = "How has your day been?" (detailed report)
# ============================================================

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from database import get_db
import monitoring

logger = logging.getLogger("notes_api.health")

router = APIRouter(tags=["Health and Monitoring"])


# ── HEALTH CHECK ─────────────────────────────────────────────
@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Checks if the application and database are healthy.
    Returns 'healthy' or 'unhealthy' with details.
    """
    logger.debug("Health check endpoint was called")

    # ── Check the database ────────────────────────────────
    # We run a simple "SELECT 1" query — if it works,
    # the database is reachable and responding
    try:
        db.execute(text("SELECT 1"))
        database_status = "healthy"
        logger.debug("Database check passed")

    except Exception as error:
        database_status = "unhealthy"
        logger.error(f"Database check failed: {error}")

    # ── Determine overall status ──────────────────────────
    if database_status == "unhealthy":
        overall_status = "unhealthy"
        logger.warning("Health check result: UNHEALTHY — database is down")
    else:
        overall_status = "healthy"
        logger.info("Health check result: HEALTHY")

    return {
        "status":    overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime":    monitoring.get_uptime(),
        "checks": {
            "application": "healthy",
            "database":    database_status
        }
    }


# ── STATS ─────────────────────────────────────────────────────
@router.get("/stats")
def get_stats():
    """
    Returns live metrics about the application.

    This is the simplest form of monitoring — just expose numbers.
    In a real production app you would use Prometheus + Grafana
    to visualize these numbers as graphs and dashboards.
    The idea is exactly the same — track numbers over time.
    """
    logger.info("Stats endpoint was called")

    summary = monitoring.get_summary()

    # Use our own metrics to trigger warnings in the logs
    # This shows how monitoring data can drive log messages
    if summary["error_rate_percent"] > 20:
        logger.warning(
            f"High error rate detected: {summary['error_rate_percent']}% "
            f"— more than 20% of requests are failing"
        )

    if summary["server_errors"] > 0:
        logger.warning(
            f"There have been {summary['server_errors']} server errors (500) "
            f"since the application started"
        )

    return {
        "message": "Application Statistics",
        "data":    summary
    }