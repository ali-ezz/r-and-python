from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import init_db
from app.middleware.error_handler import register_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware
from app.routers import (
    auth,
    focus,
    integrations,
    notifications,
    projects,
    system,
    tasks,
    team_chat,
    users,
    views,
)

from app.routers import (
    analytics,
    export,
    search,
    bulk_ops,
    comments,
    attachments,
    friends,
    password_reset,
    spotify,
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="5*A API - Task Management System",
    description="Advanced Task Management Backend",
    version="1.0.0",
    lifespan=lifespan,
    contact={
        "name": "5*A Support",
        "email": "admin@5stara.com",
    },
    license_info={
        "name": "MIT License",
    },
    openapi_tags=[
        {"name": "authentication", "description": "User registration, login, and token management"},
        {"name": "users", "description": "User profile management and search"},
        {"name": "projects", "description": "Project CRUD and management"},
        {"name": "tasks", "description": "Task lifecycle, assignment, and tracking"},
        {"name": "notifications", "description": "Real-time notification system"},
        {"name": "focus", "description": "Productivity tools (Pomodoro, goals, weather)"},
        {"name": "analytics", "description": "User analytics and productivity metrics"},
        {"name": "system", "description": "System health and status endpoints"},
    ],
)

# CORS MUST be first middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    rate_limit=100,
    window=60,
)
register_exception_handlers(app)

# Serve static files (avatars, uploads)
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Serve uploaded files (avatars, attachments)
AVATARS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "avatars")
os.makedirs(AVATARS_DIR, exist_ok=True)
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "5*A API"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(system.router)
app.include_router(bulk_ops.router)
app.include_router(tasks.router)
app.include_router(team_chat.router)
app.include_router(integrations.router)
app.include_router(focus.router)
app.include_router(notifications.router)
app.include_router(views.router)
app.include_router(analytics.router)
app.include_router(export.router)
app.include_router(search.router)
app.include_router(comments.router)
app.include_router(attachments.router)
app.include_router(friends.router)
app.include_router(password_reset.router)
app.include_router(spotify.router)

for router, tag in [
    (auth.router, "authentication"),
    (users.router, "users"),
    (projects.router, "projects"),
    (system.router, "system"),
    (tasks.router, "tasks"),
    (notifications.router, "notifications"),
    (focus.router, "focus"),
]:
    if hasattr(router, "tags"):
        router.tags = [tag]
