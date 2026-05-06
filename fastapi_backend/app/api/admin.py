"""Admin-only routes: audit log viewer, system stats, health checks."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc
from typing import Optional
from loguru import logger
from uuid import UUID

from app.db.database import get_db
from app.models.user import User, RoleEnum
from app.models.student import Student
from app.models.audit import AuditLog
from app.api.deps import get_current_admin, get_current_user
from app.services.cache_service import check_redis_health

router = APIRouter(tags=["Admin"])


# ─── Health Check (public) ────────────────────────────────────────────────────

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Public health check endpoint for monitoring."""
    redis_ok = await check_redis_health()
    try:
        await db.execute(select(func.count()).select_from(User))
        db_ok = True
    except Exception:
        db_ok = False

    status = "healthy" if (db_ok and redis_ok) else "degraded"
    return {
        "status": status,
        "services": {
            "database": "up" if db_ok else "down",
            "redis": "up" if redis_ok else "down",
        },
    }


# ─── Audit Logs (Admin) ──────────────────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action: CREATE, UPDATE, DELETE"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type: Student, User"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin only: retrieve paginated audit log entries."""
    query = select(AuditLog).order_by(desc(AuditLog.created_at))

    if action:
        query = query.filter(AuditLog.action == action.upper())
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    # Get total count
    count_query = select(func.count()).select_from(AuditLog)
    if action:
        count_query = count_query.filter(AuditLog.action == action.upper())
    if entity_type:
        count_query = count_query.filter(AuditLog.entity_type == entity_type)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    # Resolve actor emails for display
    actor_ids = {log.actor_id for log in logs if log.actor_id}
    actor_map = {}
    if actor_ids:
        actors_result = await db.execute(select(User).filter(User.id.in_(actor_ids)))
        for actor in actors_result.scalars().all():
            actor_map[str(actor.id)] = {
                "email": actor.email,
                "fullName": actor.full_name or actor.email.split("@")[0],
            }

    entries = []
    for log in logs:
        actor_info = actor_map.get(str(log.actor_id), {}) if log.actor_id else {}
        entries.append({
            "id": str(log.id),
            "action": log.action,
            "entityType": log.entity_type,
            "entityId": str(log.entity_id),
            "actorId": str(log.actor_id) if log.actor_id else None,
            "actorEmail": actor_info.get("email"),
            "actorName": actor_info.get("fullName"),
            "previousState": log.previous_state,
            "newState": log.new_state,
            "createdAt": log.created_at.isoformat() if log.created_at else None,
        })

    logger.info(f"Admin {current_admin.email} viewed {len(entries)} audit logs")
    return {"data": entries, "total": total, "skip": skip, "limit": limit}


# ─── System Statistics (Admin) ────────────────────────────────────────────────

@router.get("/system-stats")
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin only: system-wide statistics for the monitoring dashboard."""
    # User counts by role
    role_counts = {}
    for role in RoleEnum:
        result = await db.execute(
            select(func.count()).select_from(User).filter(User.role == role)
        )
        role_counts[role.value] = result.scalar() or 0

    # Active vs inactive users
    active_result = await db.execute(
        select(func.count()).select_from(User).filter(User.is_active == True)
    )
    active_count = active_result.scalar() or 0

    inactive_result = await db.execute(
        select(func.count()).select_from(User).filter(User.is_active == False)
    )
    inactive_count = inactive_result.scalar() or 0

    # Student stats
    total_students = await db.execute(select(func.count()).select_from(Student))
    avg_gpa = await db.execute(select(func.avg(Student.gpa)))

    # Department breakdown
    dept_stats = await db.execute(
        select(
            Student.department,
            func.count(Student.id).label("count"),
            func.avg(Student.gpa).label("avg_gpa"),
        ).group_by(Student.department)
    )
    departments = [
        {
            "department": row[0],
            "count": row[1],
            "avgGpa": round(float(row[2] or 0), 2),
        }
        for row in dept_stats.all()
    ]

    # Recent audit activity count (last 24h)
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(hours=24)
    recent_audits = await db.execute(
        select(func.count()).select_from(AuditLog).filter(AuditLog.created_at >= cutoff)
    )
    recent_audit_count = recent_audits.scalar() or 0

    # Redis health
    redis_ok = await check_redis_health()

    return {
        "data": {
            "users": {
                "total": sum(role_counts.values()),
                "byRole": role_counts,
                "active": active_count,
                "inactive": inactive_count,
            },
            "students": {
                "total": total_students.scalar() or 0,
                "avgGpa": round(float(avg_gpa.scalar() or 0), 2),
                "byDepartment": departments,
            },
            "activity": {
                "last24h": recent_audit_count,
            },
            "services": {
                "database": "up",
                "redis": "up" if redis_ok else "down",
            },
        }
    }
