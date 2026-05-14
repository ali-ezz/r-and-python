# database.py
# ============================================================
# This file handles everything related to the database:
#   1. Creating the connection to SQLite
#   2. Defining the "notes" table structure
#   3. Providing a database session to routes via get_db()
#
# We use SQLite here because it needs zero setup —
# it creates a single file (notes.db) automatically.
#
# If you want SQL Server instead, change DATABASE_URL to:
# "mssql+pyodbc://user:pass@server/dbname?driver=ODBC+Driver+17+for+SQL+Server"
# Everything else stays the same.
# ============================================================

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("notes_api.database")

# ── Connection URL ───────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = (
    "mssql+pyodbc://@USER/notes_api"
    "?driver=ODBC+Driver+17+for+SQL+Server"
    "&trusted_connection=yes"
)

# ── Engine ───────────────────────────────────────────────────
# The engine is the actual connection to the database.
# connect_args is needed only for SQLite (not for SQL Server)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL
)

# ── Session Factory ──────────────────────────────────────────
# SessionLocal is a factory that creates new database sessions.
# Each request gets its own session (like its own conversation
# with the database).
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# ── Base ─────────────────────────────────────────────────────
# All table definitions must inherit from Base.
Base = declarative_base()


# ── Create Tables ────────────────────────────────────────────
def create_tables():
    """
    Creates all tables in the database if they do not exist.
    We call this once when the application starts.
    """
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables are ready")


# ── Database Session Dependency ──────────────────────────────
def get_db():
    """
    This function provides a database session to each route.
    It opens a session, gives it to the route, then closes it
    after the route finishes — whether it succeeded or failed.

    Usage in routes:
        def my_route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    logger.debug("Database session opened")
    try:
        yield db
    except Exception as error:
        db.rollback()
        logger.error(f"Database error — rolling back transaction: {error}")
        raise
    finally:
        db.close()
        logger.debug("Database session closed")