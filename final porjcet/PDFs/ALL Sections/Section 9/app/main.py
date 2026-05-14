# main.py
# ============================================================
# This is the entry point — where everything starts.
#
# ORDER OF SETUP MATTERS:
#   1. Setup logging FIRST so nothing is missed
#   2. Create the FastAPI app
#   3. Register startup/shutdown behavior
#   4. Add middleware
#   5. Include routers
# ============================================================

import logging
from fastapi import FastAPI
from logger_setup import setup_logger
from database import create_tables
from middleware import log_requests
from routers import notes, health

# ── Step 1: Setup logging before anything else ───────────────
# If we do not do this first, early messages will not be logged
setup_logger()
logger = logging.getLogger("notes_api.main")


# ── Step 2: Create the FastAPI app ───────────────────────────
app = FastAPI(
    title       = "Notes API",
    description = "A simple Notes API for learning logging and monitoring",
    version     = "1.0.0"
)


# ── Step 3: Startup event ────────────────────────────────────
# Runs ONCE when the server starts
@app.on_event("startup")
def on_startup():
    logger.info("=" * 55)
    logger.info("  Notes API is starting...")
    logger.info("  Endpoints available:")
    logger.info("    GET    /health         → Health check")
    logger.info("    GET    /stats          → App metrics")
    logger.info("    GET    /notes          → Get all notes")
    logger.info("    POST   /notes          → Create a note")
    logger.info("    GET    /notes/{id}     → Get one note")
    logger.info("    PUT    /notes/{id}     → Update a note")
    logger.info("    DELETE /notes/{id}     → Delete a note")
    logger.info("    GET    /docs           → API documentation")
    logger.info("=" * 55)

    # Create database tables if they do not exist
    create_tables()
    logger.info("Application is ready to receive requests")


# ── Step 4: Shutdown event ───────────────────────────────────
# Runs ONCE when the server stops
@app.on_event("shutdown")
def on_shutdown():
    logger.info("Notes API is shutting down — goodbye!")


# ── Step 5: Add middleware ───────────────────────────────────
# Must be added BEFORE routes are included
# Every request will automatically pass through log_requests()
app.middleware("http")(log_requests)
logger.debug("Request logging middleware registered")


# ── Step 6: Include routers ──────────────────────────────────
app.include_router(notes.router)
app.include_router(health.router)
logger.debug("All routers registered")