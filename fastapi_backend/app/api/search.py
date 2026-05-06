from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models.student import Student
from app.schemas.student import StudentResponse
from sqlalchemy.future import select
from sqlalchemy import or_

router = APIRouter(tags=["Search"])

@router.get("/students")
async def search_students(
    q: str = Query("", description="Search query"),
    page: int = 1,
    limit: int = 15,
    gpaMin: Optional[float] = None,
    gpaMax: Optional[float] = None,
    department: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy.orm import selectinload
    query = select(Student).options(selectinload(Student.user))
    if q:
        query = query.filter(
            or_(
                Student.first_name.ilike(f"%{q}%"),
                Student.last_name.ilike(f"%{q}%"),
                Student.department.ilike(f"%{q}%")
            )
        )
    if gpaMin is not None:
        query = query.filter(Student.gpa >= gpaMin)
    if gpaMax is not None:
        query = query.filter(Student.gpa <= gpaMax)
    if department:
        query = query.filter(Student.department.ilike(f"%{department}%"))
    if year:
        query = query.filter(Student.enrollment_year == str(year))
    if status is not None and hasattr(Student, 'status'):
        query = query.filter(Student.status == status)
        
    # Count total
    from sqlalchemy import func
    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    students = result.scalars().all()
    
    # Map to schema-like dictionary to include user fields safely
    mapped_students = []
    for s in students:
        mapped_students.append({
            "id": str(s.id),
            "first_name": s.first_name,
            "last_name": s.last_name,
            "department": s.department,
            "enrollment_year": s.enrollment_year,
            "gpa": s.gpa,
            "status": "ACTIVE" if (s.user and s.user.is_active) else "INACTIVE",
            "email": s.user.email if s.user else None,
            "user": {"email": s.user.email if s.user else None},
            "_count": {"enrollments": 0}
        })
    
    return {
        "data": mapped_students,
        "total": total,
        "page": page,
        "totalPages": (total + limit - 1) // limit,
        "query": q,
        "durationMs": 0,
        "analytics": { "hasResults": total > 0, "resultCount": total }
    }
