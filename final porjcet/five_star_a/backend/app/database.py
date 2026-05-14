from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_admin_user(db: Session) -> None:
    from app.models.user import User, UserRole
    from app.models.workspace import Workspace
    from app.utils.security import get_password_hash

    default_ws = db.query(Workspace).first()
    if not default_ws:
        default_ws = Workspace(name="Default organization")
        db.add(default_ws)
        db.flush()

    admin = db.query(User).filter(User.email == "admin@5stara.com").first()
    if admin:
        # If admin exists but has a placeholder hash, update it
        if admin.hashed_password.startswith("$2b$12$placeholder") or admin.hashed_password == "placeholder_hash_replace_on_first_login":
            admin.hashed_password = get_password_hash("admin12345")
            admin.full_name = "System Admin"
            admin.is_active = True
            admin.is_verified = True
            if hasattr(admin, 'role'):
                admin.role = UserRole.admin if hasattr(admin.role, 'value') else "admin"
            db.commit()
            logger.info("Updated default admin user with proper credentials")
        return

    admin = User(
        email="admin@5stara.com",
        username="admin",
        hashed_password=get_password_hash("admin12345"),
        full_name="System Admin",
        workspace_id=default_ws.id,
        role=UserRole.admin,
        is_active=True,
        is_verified=True,
    )
    db.add(admin)
    db.commit()
    logger.info("Seeded default admin user")


def init_db() -> None:
    """Initialize database using Alembic migrations or fallback to create_all.
    
    Production mode: Uses Alembic migrations (preferred)
    Development mode: Falls back to create_all if Alembic not configured
    """
    import os
    
    # Check if we should use Alembic migrations
    use_alembic = os.getenv("USE_ALEMBIC", "false").lower() == "true"
    
    if use_alembic:
        try:
            from alembic import command
            from alembic.config import Config
            
            alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
            command.upgrade(alembic_cfg, "head")
            logger.info("Database initialized via Alembic migrations")
        except Exception as e:
            logger.warning(f"Alembic migration failed, falling back to create_all: {e}")
            _init_db_fallback()
    else:
        _init_db_fallback()
    
    # Always seed admin user
    db = SessionLocal()
    try:
        _seed_admin_user(db)
    finally:
        db.close()


def _init_db_fallback() -> None:
    """Fallback: create tables directly (development mode only)."""
    from app.models import (  # noqa: F401
        DailyGoal,
        Device,
        FriendConnection,
        Integration,
        Notification,
        OAuthAccount,
        PomodoroSession,
        Project,
        ProjectMember,
        RefreshToken,
        Task,
        TaskAttachment,
        TaskComment,
        TeamChatMessage,
        User,
        UserAnalytics,
        WidgetState,
        Workspace,
    )

    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized via create_all (development mode)")
