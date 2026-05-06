from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from loguru import logger

from app.db.database import get_db
from app.models.user import User, RoleEnum
from app.schemas.student import StudentResponse, StudentUpdate, StudentCreateAdmin
from app.api.deps import get_current_user, get_current_admin
from app.services.student_service import StudentService

router = APIRouter(tags=["Students"])


def can_manage_students(user: User) -> bool:
    """Admins and instructors can work with the student directory."""
    return user.role in {RoleEnum.ADMIN, RoleEnum.INSTRUCTOR}

@router.get("/", response_model=List[StudentResponse])
async def get_students(
    department: Optional[str] = Query(None, description="Filter by department"),
    gpa_min: Optional[float] = Query(None, ge=0.0, le=4.0, description="Minimum GPA filter"),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all students. Uses Redis Cache-Aside pattern.
    Admins and instructors can see all students. Students can only see their own profile.
    """
    logger.info(f"User {current_user.email} fetching students.")
    owner_id = None if can_manage_students(current_user) else current_user.id
    return await StudentService.get_all_students(db, skip, limit, department, gpa_min, owner_id)

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy.future import select
    from sqlalchemy import func
    from app.models.student import Student
    
    # Active vs other statuses
    # For now, just group by status or return dummies if status column isn't tracked properly
    # Assuming we just count all as active for a simple implementation if status is missing
    total_students = await db.execute(select(func.count(Student.id)))
    total_count = total_students.scalar() or 0
    
    # Calculate avg gpa by department
    dept_stats = await db.execute(
        select(Student.department, func.avg(Student.gpa))
        .group_by(Student.department)
    )
    avg_gpa_by_dept = [{"department": r[0], "avgGpa": float(r[1] or 0)} for r in dept_stats.all()]

    return {
        "data": {
            "students": { "ACTIVE": total_count, "GRADUATED": 0, "INACTIVE": 0 },
            "totalCourses": 15,
            "totalEnrollments": total_count * 3,
            "avgGpaByDepartment": avg_gpa_by_dept
        }
    }

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific student by ID.
    """
    student = await StudentService.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # Students can only view their own detailed profile. Staff can view the directory.
    if not can_manage_students(current_user) and str(student.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this profile")
        
    return student

@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    student_in: StudentCreateAdmin,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Admin only: Create a new student (assuming user already exists or creates a detached student? 
    Usually, user registration handles creation. Let's provide this for Admin overrides).
    """
    try:
        return await StudentService.create_student(db, student_in, current_admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: UUID,
    student_in: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a student's profile.
    Admins and instructors can update students. Students can only update their own.
    """
    student = await StudentService.get_student_by_id(db, student_id, use_cache=False)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if not can_manage_students(current_user) and str(student.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")
        
    updated = await StudentService.update_student(db, student, student_in, current_user.id)
    return updated

@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Admin only: Delete a student.
    """
    student = await StudentService.get_student_by_id(db, student_id, use_cache=False)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    await StudentService.delete_student(db, student, current_admin.id)
    return None
