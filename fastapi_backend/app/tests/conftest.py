"""
Test configuration and fixtures.

Uses SQLite in-memory for fast, isolated test execution.
Overrides the database dependency and creates tables before the test session.
"""

import os
import asyncio
import pytest
from fastapi.testclient import TestClient

# Override environment BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["CACHE_ENABLED"] = "false"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ADMIN_EMAIL"] = "admin@sms.edu"
os.environ["ADMIN_PASSWORD"] = "Admin@2026"

from app.main import app
from app.db.database import Base, get_db, engine, AsyncSessionLocal


async def override_get_db():
    """Provide a clean database session for each request."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True, scope="session")
def setup_database():
    """Create all tables before the test session and drop them after."""
    async def _setup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        # Seed the admin user for tests
        from app.models.user import User, RoleEnum
        from app.core.security import get_password_hash
        from sqlalchemy.future import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).filter(User.email == "admin@sms.edu")
            )
            if result.scalar_one_or_none() is None:
                admin_user = User(
                    email="admin@sms.edu",
                    full_name="System Administrator",
                    hashed_password=get_password_hash("Admin@2026"),
                    role=RoleEnum.ADMIN,
                    is_active=True,
                )
                session.add(admin_user)
                await session.commit()

    async def _teardown():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    asyncio.run(_setup())
    yield
    asyncio.run(_teardown())


@pytest.fixture
def client():
    """Provide a TestClient with database dependency override."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()
