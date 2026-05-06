import json
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List
from loguru import logger

from app.models.student import Student
from app.models.audit import AuditLog
from app.models.user import User, RoleEnum
from app.schemas.student import StudentUpdate, StudentCreateAdmin
from app.core.security import get_password_hash
from app.services.cache_service import CacheService

class StudentService:
    CACHE_KEY_PREFIX = "students"

    @staticmethod
    async def get_all_students(
        db: AsyncSession,
        skip: int,
        limit: int,
        department: Optional[str],
        gpa_min: Optional[float],
        owner_id: Optional[UUID],
    ) -> List[Student]:
        scope = str(owner_id) if owner_id else "all"
        cache_key = f"{StudentService.CACHE_KEY_PREFIX}:all:{scope}:{skip}:{limit}:{department}:{gpa_min}"
        
        # 1. Check Cache
        cached_data = await CacheService.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for key: {cache_key}")
            # Cache returns dicts, we need to return objects or Pydantic models will handle dicts
            return cached_data

        # 2. Query DB
        logger.debug(f"Cache miss for key: {cache_key}. Querying DB...")
        query = select(Student)
        if department:
            query = query.filter(Student.department == department)
        if gpa_min is not None:
            query = query.filter(Student.gpa >= gpa_min)
        if owner_id:
            query = query.filter(Student.user_id == owner_id)
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        students = result.scalars().all()

        # 3. Save to Cache
        # Convert objects to dicts for JSON serialization
        students_dict = []
        for s in students:
            students_dict.append({
                "id": str(s.id),
                "user_id": str(s.user_id),
                "first_name": s.first_name,
                "last_name": s.last_name,
                "department": s.department,
                "gpa": s.gpa,
                "enrollment_year": s.enrollment_year
            })
        await CacheService.set(cache_key, students_dict, expire=300) # 5 min
        
        return students

    @staticmethod
    async def create_student(
        db: AsyncSession,
        student_in: StudentCreateAdmin,
        actor_id: UUID,
    ) -> Student:
        existing = await db.execute(select(User).filter(User.email == student_in.email))
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            email=student_in.email,
            full_name=f"{student_in.first_name} {student_in.last_name}".strip(),
            hashed_password=get_password_hash(student_in.password),
            role=RoleEnum.STUDENT,
            is_active=True,
        )
        student = Student(
            user=user,
            first_name=student_in.first_name,
            last_name=student_in.last_name,
            department=student_in.department,
            enrollment_year=student_in.enrollment_year,
            gpa=student_in.gpa,
        )

        db.add(user)
        db.add(student)
        await db.flush()

        audit = AuditLog(
            action="CREATE",
            entity_type="Student",
            entity_id=student.id,
            actor_id=actor_id,
            previous_state=None,
            new_state={
                "first_name": student.first_name,
                "last_name": student.last_name,
                "department": student.department,
                "gpa": student.gpa,
                "enrollment_year": student.enrollment_year,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(student)

        await CacheService.delete_pattern(f"{StudentService.CACHE_KEY_PREFIX}:all:*")

        logger.info(f"Student {student.id} created by {actor_id}")
        return student

    @staticmethod
    async def get_student_by_id(db: AsyncSession, student_id: UUID, use_cache: bool = True) -> Optional[Student]:
        cache_key = f"{StudentService.CACHE_KEY_PREFIX}:{student_id}"
        
        cached_data = await CacheService.get(cache_key) if use_cache else None
        if cached_data:
            logger.debug(f"Cache hit for student: {student_id}")
            # Mock object to satisfy Pydantic from_attributes
            class Struct:
                def __init__(self, **entries):
                    self.__dict__.update(entries)
            return Struct(**cached_data)

        query = select(Student).filter(Student.id == student_id)
        result = await db.execute(query)
        student = result.scalar_one_or_none()

        if student:
            student_dict = {
                "id": str(student.id),
                "user_id": str(student.user_id),
                "first_name": student.first_name,
                "last_name": student.last_name,
                "department": student.department,
                "gpa": student.gpa,
                "enrollment_year": student.enrollment_year
            }
            await CacheService.set(cache_key, student_dict, expire=600)
            
        return student

    @staticmethod
    async def update_student(db: AsyncSession, student: Student, update_data: StudentUpdate, actor_id: UUID) -> Student:
        previous_state = {
            "first_name": student.first_name,
            "last_name": student.last_name,
            "department": student.department,
            "gpa": student.gpa,
            "enrollment_year": student.enrollment_year
        }

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(student, key, value)
            
        # Audit Log
        audit = AuditLog(
            action="UPDATE",
            entity_type="Student",
            entity_id=student.id,
            actor_id=actor_id,
            previous_state=previous_state,
            new_state=update_dict
        )
        db.add(audit)
        
        await db.commit()
        await db.refresh(student)
        
        # Invalidate Cache
        await CacheService.delete(f"{StudentService.CACHE_KEY_PREFIX}:{student.id}")
        await CacheService.delete_pattern(f"{StudentService.CACHE_KEY_PREFIX}:all:*")
        
        logger.info(f"Student {student.id} updated by {actor_id}")
        return student

    @staticmethod
    async def delete_student(db: AsyncSession, student: Student, actor_id: UUID):
        previous_state = {
            "first_name": student.first_name,
            "last_name": student.last_name
        }
        
        # Audit Log
        audit = AuditLog(
            action="DELETE",
            entity_type="Student",
            entity_id=student.id,
            actor_id=actor_id,
            previous_state=previous_state,
            new_state=None
        )
        db.add(audit)
        
        await db.delete(student)
        await db.commit()
        
        # Invalidate Cache
        await CacheService.delete(f"{StudentService.CACHE_KEY_PREFIX}:{student.id}")
        await CacheService.delete_pattern(f"{StudentService.CACHE_KEY_PREFIX}:all:*")
        
        logger.warning(f"Student {student.id} deleted by {actor_id}")
