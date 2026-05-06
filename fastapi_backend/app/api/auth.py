"""Authentication & user management routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from loguru import logger

from app.db.database import get_db
from app.models.user import User, RoleEnum
from app.models.student import Student
from app.schemas.user import UserCreate, UserCreateAdmin, UserResponse, UserUpdate, UserDetailResponse
from app.schemas.auth import LoginResponse, MeResponse, TokenResponse, MessageResponse
from app.core.security import get_password_hash, verify_password, create_access_token
from app.api.deps import get_current_user, get_current_admin

router = APIRouter(tags=["Auth"])


def _split_name(full_name: str) -> tuple[str, str]:
    name_parts = (full_name or "New User").strip().split(" ", 1)
    first_name = name_parts[0] if name_parts else "New"
    last_name = name_parts[1] if len(name_parts) > 1 else "User"
    return first_name, last_name


def _user_row_payload(user: User) -> dict:
    profile = getattr(user, "student_profile", None)
    return {
        "id": str(user.id),
        "email": user.email,
        "fullName": user.full_name or "",
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "isActive": user.is_active,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
        "updatedAt": user.updated_at.isoformat() if user.updated_at else None,
        "firstName": profile.first_name if profile else None,
        "lastName": profile.last_name if profile else None,
        "department": profile.department if profile else None,
        "gpa": profile.gpa if profile else None,
        "enrollmentYear": profile.enrollment_year if profile else None,
    }


def _student_profile_payload(data: UserCreateAdmin | UserUpdate, full_name: str) -> dict:
    first_name, last_name = _split_name(full_name)
    return {
        "first_name": data.first_name or first_name,
        "last_name": data.last_name or last_name,
        "department": data.department or "Undecided",
        "enrollment_year": data.enrollment_year or "2026",
        "gpa": data.gpa if data.gpa is not None else 0.0,
    }


# ─── Registration ─────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new student account with automatic profile creation."""
    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalars().first():
        logger.warning(f"Registration failed: Email {user_in.email} already exists.")
        raise HTTPException(status_code=400, detail="Email already registered")

    # Derive full_name from email if not provided
    full_name = user_in.full_name or user_in.email.split("@")[0].replace(".", " ").title()

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        full_name=full_name,
        hashed_password=hashed_password,
        role=RoleEnum.STUDENT,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create a student profile linked to this user
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0] if name_parts else "New"
    last_name = name_parts[1] if len(name_parts) > 1 else "User"

    student_profile = Student(
        user_id=new_user.id,
        first_name=first_name,
        last_name=last_name,
        department="Undecided",
        enrollment_year="2026",
    )
    db.add(student_profile)
    await db.commit()

    logger.info(f"User registered successfully: {new_user.email} ({full_name})")
    return new_user


# ─── Login ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Login request payload."""
    email: str
    password: str

def _auth_user_payload(user: User) -> dict:
    """Serialize auth user data with the linked student name when available."""
    profile = getattr(user, "student_profile", None)
    profile_payload = None
    if profile:
        profile_payload = {
            "firstName": profile.first_name,
            "lastName": profile.last_name,
            "department": profile.department,
        }

    full_name = user.full_name or ""
    if not full_name and profile:
        full_name = f"{profile.first_name} {profile.last_name}".strip()

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "isActive": user.is_active,
        "fullName": full_name,
        "profile": profile_payload,
    }


@router.post("/login", response_model=LoginResponse)
async def login(form_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT token."""
    result = await db.execute(
        select(User).options(selectinload(User.student_profile)).filter(User.email == form_data.email)
    )
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for user: {form_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        logger.warning(f"Inactive user login attempt: {form_data.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact an administrator.",
        )

    access_token = create_access_token(subject=user.id)
    logger.info(f"User logged in: {user.email} (role={user.role.value})")
    return {
        "data": {
            "accessToken": access_token,
            "user": _auth_user_payload(user),
        }
    }


# ─── Current User ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=MeResponse)
async def read_users_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user's profile."""
    result = await db.execute(
        select(User).options(selectinload(User.student_profile)).filter(User.id == current_user.id)
    )
    user = result.scalar_one_or_none() or current_user
    return {
        "data": {
            "user": _auth_user_payload(user)
        }
    }


# ─── Logout & Refresh ─────────────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
async def logout():
    """Logout (client-side token discard)."""
    return {"message": "Logged out"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(current_user: User = Depends(get_current_user)):
    """Refresh access token."""
    access_token = create_access_token(subject=current_user.id)
    return {"data": {"accessToken": access_token}}


# ─── Admin: List All Users ────────────────────────────────────────────────────

@router.post("/users", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin only: create an admin, instructor, or student account."""
    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    full_name = user_in.full_name or user_in.email.split("@")[0].replace(".", " ").title()
    user = User(
        email=user_in.email,
        full_name=full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(user)
    await db.flush()

    if user_in.role == RoleEnum.STUDENT:
        profile_data = _student_profile_payload(user_in, full_name)
        db.add(Student(user_id=user.id, **profile_data))

    await db.commit()
    result = await db.execute(
        select(User).options(selectinload(User.student_profile)).filter(User.id == user.id)
    )
    created = result.scalar_one()

    logger.info(
        f"Admin {current_user.email} created user {created.email} "
        f"(role={created.role.value if hasattr(created.role, 'value') else created.role})"
    )
    return {"data": _user_row_payload(created), "message": "User created successfully"}

@router.get("/users", response_model=dict)
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin only: list all users with their student profile data."""
    result = await db.execute(
        select(User).options(selectinload(User.student_profile)).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    user_list = [_user_row_payload(u) for u in users]

    logger.info(f"Admin {current_user.email} fetched {len(user_list)} users")
    return {"data": user_list, "total": len(user_list)}


# ─── Admin: Update User ───────────────────────────────────────────────────────

@router.put("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin only: update a user's role, name, or active status."""
    from uuid import UUID as PyUUID
    try:
        uid = PyUUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    result = await db.execute(
        select(User).options(selectinload(User.student_profile)).filter(User.id == uid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-demotion
    if str(user.id) == str(current_user.id) and user_update.role and user_update.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot change your own admin role")

    update_dict = user_update.model_dump(exclude_unset=True)
    profile_fields = {"first_name", "last_name", "department", "enrollment_year", "gpa"}
    user_fields = {key: value for key, value in update_dict.items() if key not in profile_fields}
    for key, value in user_fields.items():
        setattr(user, key, value)

    profile_updates = {key: value for key, value in update_dict.items() if key in profile_fields}
    should_create_profile = user.role == RoleEnum.STUDENT or bool(profile_updates)
    if should_create_profile and user.student_profile is None:
        profile_data = _student_profile_payload(user_update, user.full_name or user.email.split("@")[0])
        user.student_profile = Student(user_id=user.id, **profile_data)
    elif user.student_profile and profile_updates:
        for key, value in profile_updates.items():
            setattr(user.student_profile, key, value)

    await db.commit()
    result = await db.execute(
        select(User).options(selectinload(User.student_profile)).filter(User.id == uid)
    )
    user = result.scalar_one()

    logger.info(f"Admin {current_user.email} updated user {user.email}: {update_dict}")
    return {
        "data": _user_row_payload(user),
        "message": "User updated successfully",
    }


# ─── Admin: Delete User ───────────────────────────────────────────────────────

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin only: permanently delete a user and their student profile."""
    from uuid import UUID as PyUUID
    try:
        uid = PyUUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).filter(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.warning(f"Admin {current_user.email} DELETED user {user.email}")
    await db.delete(user)
    await db.commit()
    return None
