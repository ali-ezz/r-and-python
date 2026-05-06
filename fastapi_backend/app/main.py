"""
FastAPI Application Entry Point.

Student Management System — a production-grade backend with JWT auth,
role-based access control, Redis caching, structured logging, and
Prometheus metrics.
"""

from fastapi import FastAPI, Request, status
import time
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from loguru import logger

from app.core.config import settings
from app.core.logger import setup_logging
from app.api import auth, students, search, admin
from app.db.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, RoleEnum
from app.models.student import Student
from sqlalchemy.future import select
from sqlalchemy import text

# ─── Setup Structured Logging ─────────────────────────────────────────────────
setup_logging()

# ─── Application Factory ──────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Student Management System — FastAPI backend with JWT, RBAC, Redis, and monitoring.",
    version="2.0.0",
)

# ─── CORS Configuration ───────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:80",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a sanitized 500 response."""
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )

# ─── Request Logging Middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every HTTP request with method, path, status code, and duration."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} "
        f"({duration_ms:.1f}ms)"
    )
    return response

# ─── Include Routers ──────────────────────────────────────────────────────────
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth")
app.include_router(students.router, prefix=f"{settings.API_V1_STR}/students")
app.include_router(search.router, prefix=f"{settings.API_V1_STR}/search")
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin")

# ─── Prometheus Metrics ───────────────────────────────────────────────────────
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_respect_env_var=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=[".*admin.*", "/metrics"],
    env_var_name="ENABLE_METRICS",
    inprogress_name="inprogress",
    inprogress_labels=True,
)
instrumentator.instrument(app).expose(app, endpoint="/metrics")

# ─── Startup: Create Tables & Bootstrap Admin ─────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Initialize database tables and seed the default admin user."""
    logger.info("Starting up FastAPI application...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            try:
                # Provide an automatic migration for the full_name field since Alembic is not used.
                await conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR DEFAULT '';"))
            except Exception as e:
                # Column already exists or table structure doesn't support it
                pass

        async with AsyncSessionLocal() as session:
            async def ensure_user(
                email: str,
                password: str,
                full_name: str,
                role: RoleEnum,
                student_profile: dict | None = None,
            ) -> User:
                result = await session.execute(
                    select(User).filter(User.email == email)
                )
                user = result.scalar_one_or_none()
                if user is None:
                    user = User(
                        email=email,
                        full_name=full_name,
                        hashed_password=get_password_hash(password),
                        role=role,
                        is_active=True,
                    )
                    session.add(user)
                    await session.flush()
                    logger.info(f"Demo user bootstrapped: {email} ({role.value})")
                else:
                    user.full_name = user.full_name or full_name
                    user.hashed_password = get_password_hash(password)
                    user.role = role
                    user.is_active = True

                if student_profile:
                    profile_result = await session.execute(
                        select(Student).filter(Student.user_id == user.id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    if profile is None:
                        session.add(Student(user_id=user.id, **student_profile))
                    else:
                        for key, value in student_profile.items():
                            setattr(profile, key, value)
                return user

            result = await session.execute(
                select(User).filter(User.email == settings.ADMIN_EMAIL)
            )
            existing_admin = result.scalar_one_or_none()
            if existing_admin is None:
                admin_user = User(
                    email=settings.ADMIN_EMAIL,
                    full_name="System Administrator",
                    hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                    role=RoleEnum.ADMIN,
                    is_active=True,
                )
                session.add(admin_user)
                await session.commit()
                logger.info(f"Admin user bootstrapped: {settings.ADMIN_EMAIL}")
            elif not existing_admin.full_name:
                existing_admin.full_name = "System Administrator"

            await ensure_user(
                "dr.ahmed@sms.edu",
                "Instructor@2026",
                "Dr. Ahmed Hassan",
                RoleEnum.INSTRUCTOR,
            )
            await ensure_user(
                "dr.sarah@sms.edu",
                "Instructor@2026",
                "Sarah Student",
                RoleEnum.STUDENT,
                {
                    "first_name": "Sarah",
                    "last_name": "Student",
                    "department": "Computer Science",
                    "enrollment_year": "2026",
                    "gpa": 3.7,
                },
            )
            await session.commit()
    except Exception as exc:
        logger.warning(f"Startup bootstrap skipped: {exc}")

# ─── Shutdown ─────────────────────────────────────────────────────────────────
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up database connections on shutdown."""
    logger.info("Shutting down FastAPI application...")
    await engine.dispose()
