"""
Comprehensive student CRUD tests.

Tests cover: CRUD operations, role restrictions, pagination, filtering,
audit logging, business logic validation, and edge cases.
"""

import pytest
import asyncio
from sqlalchemy.future import select

from app.db.database import AsyncSessionLocal
from app.models.audit import AuditLog


@pytest.fixture
def student_headers(client):
    """Authenticate as a student user."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "student1@example.com", "password": "Password1", "full_name": "Student One"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "student1@example.com", "password": "Password1"},
    )
    token = response.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client):
    """Authenticate as the admin user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@sms.edu", "password": "Admin@2026"},
    )
    token = response.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _get_audit_entries(action: str):
    """Helper to fetch audit log entries from the database."""
    async def _fetch():
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AuditLog).filter(AuditLog.action == action)
            )
            return result.scalars().all()
    return asyncio.run(_fetch())


# ─── Auth Guard Tests ─────────────────────────────────────────────────────────

def test_students_requires_auth(client):
    """Test that student list requires authentication."""
    response = client.get("/api/v1/students/")
    assert response.status_code == 401


# ─── Student Isolation Tests ──────────────────────────────────────────────────

def test_get_students_student_isolation(client, student_headers):
    """Test that students can only see their own profile."""
    response = client.get("/api/v1/students/", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1


# ─── Update Tests ─────────────────────────────────────────────────────────────

def test_update_student_profile(client, student_headers):
    """Test that a student can update their own profile and audit is created."""
    me_response = client.get("/api/v1/auth/me", headers=student_headers)
    user_id = me_response.json()["data"]["user"]["id"]

    students_response = client.get("/api/v1/students/", headers=student_headers)
    students = students_response.json()
    my_student = next(s for s in students if s["user_id"] == user_id)

    update_response = client.put(
        f"/api/v1/students/{my_student['id']}",
        json={"first_name": "Updated", "department": "Science", "gpa": 3.8},
        headers=student_headers,
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["first_name"] == "Updated"
    assert data["department"] == "Science"
    assert data["gpa"] == 3.8

    # Verify audit trail
    audits = _get_audit_entries("UPDATE")
    assert len(audits) >= 1


def test_update_invalid_gpa(client, student_headers):
    """Test that GPA > 4.0 is rejected with 422."""
    students_response = client.get("/api/v1/students/", headers=student_headers)
    students = students_response.json()
    if students:
        response = client.put(
            f"/api/v1/students/{students[0]['id']}",
            json={"gpa": 5.0},
            headers=student_headers,
        )
        assert response.status_code == 422


def test_update_negative_gpa(client, student_headers):
    """Test that negative GPA is rejected with 422."""
    students_response = client.get("/api/v1/students/", headers=student_headers)
    students = students_response.json()
    if students:
        response = client.put(
            f"/api/v1/students/{students[0]['id']}",
            json={"gpa": -1.0},
            headers=student_headers,
        )
        assert response.status_code == 422


# ─── Admin CRUD Tests ─────────────────────────────────────────────────────────

def test_admin_create_and_delete_student(client, admin_headers):
    """Test admin can create and delete a student with audit logging."""
    create_response = client.post(
        "/api/v1/students/",
        json={
            "email": "student2@example.com",
            "password": "Password1",
            "first_name": "Student",
            "last_name": "Two",
            "department": "Math",
            "enrollment_year": "2026",
            "gpa": 3.2,
        },
        headers=admin_headers,
    )
    assert create_response.status_code == 201
    student_id = create_response.json()["id"]

    # Verify audit log
    audits = _get_audit_entries("CREATE")
    assert len(audits) >= 1

    delete_response = client.delete(
        f"/api/v1/students/{student_id}",
        headers=admin_headers,
    )
    assert delete_response.status_code == 204

    audits = _get_audit_entries("DELETE")
    assert len(audits) >= 1


def test_admin_create_student_duplicate_email(client, admin_headers):
    """Test that creating a student with existing email returns 400."""
    payload = {
        "email": "dup_student@example.com",
        "password": "Password1",
        "first_name": "First",
        "last_name": "Last",
        "department": "CS",
        "enrollment_year": "2025",
        "gpa": 3.0,
    }
    client.post("/api/v1/students/", json=payload, headers=admin_headers)
    response = client.post("/api/v1/students/", json=payload, headers=admin_headers)
    assert response.status_code == 400


# ─── Role Restriction Tests ──────────────────────────────────────────────────

def test_student_cannot_delete_other_student(client, admin_headers, student_headers):
    """Test students get 403 when trying to delete another student."""
    create_response = client.post(
        "/api/v1/students/",
        json={
            "email": "student3@example.com",
            "password": "Password1",
            "first_name": "Student",
            "last_name": "Three",
            "department": "Physics",
            "enrollment_year": "2026",
            "gpa": 3.4,
        },
        headers=admin_headers,
    )
    student_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/api/v1/students/{student_id}",
        headers=student_headers,
    )
    assert delete_response.status_code == 403


def test_student_cannot_view_other_student(client, admin_headers, student_headers):
    """Test students get 403 when trying to view another student's profile."""
    create_response = client.post(
        "/api/v1/students/",
        json={
            "email": "student4@example.com",
            "password": "Password1",
            "first_name": "Student",
            "last_name": "Four",
            "department": "Chemistry",
            "enrollment_year": "2026",
            "gpa": 3.1,
        },
        headers=admin_headers,
    )
    student_id = create_response.json()["id"]

    get_response = client.get(
        f"/api/v1/students/{student_id}",
        headers=student_headers,
    )
    assert get_response.status_code == 403


def test_student_cannot_create_student(client, student_headers):
    """Test students cannot access admin-only create endpoint (403)."""
    response = client.post(
        "/api/v1/students/",
        json={
            "email": "sneaky@example.com",
            "password": "Password1",
            "first_name": "Sneaky",
            "last_name": "User",
            "department": "CS",
            "enrollment_year": "2025",
            "gpa": 4.0,
        },
        headers=student_headers,
    )
    assert response.status_code == 403


# ─── Pagination & Filter Tests ────────────────────────────────────────────────

def test_pagination_and_filters(client, admin_headers):
    """Test pagination and department/GPA filtering."""
    client.post(
        "/api/v1/students/",
        json={
            "email": "student5@example.com",
            "password": "Password1",
            "first_name": "Student",
            "last_name": "Five",
            "department": "Science",
            "enrollment_year": "2026",
            "gpa": 3.9,
        },
        headers=admin_headers,
    )
    client.post(
        "/api/v1/students/",
        json={
            "email": "student6@example.com",
            "password": "Password1",
            "first_name": "Student",
            "last_name": "Six",
            "department": "Math",
            "enrollment_year": "2026",
            "gpa": 2.5,
        },
        headers=admin_headers,
    )

    # Test pagination
    response = client.get(
        "/api/v1/students/?skip=0&limit=1",
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert len(response.json()) == 1

    # Test filters
    response = client.get(
        "/api/v1/students/?department=Science&gpa_min=3.5",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert all(s["department"] == "Science" for s in data)
    assert all(s["gpa"] >= 3.5 for s in data)


# ─── Edge Case: Missing Resource ──────────────────────────────────────────────

def test_get_nonexistent_student(client, admin_headers):
    """Test that fetching a non-existent student returns 404."""
    response = client.get(
        "/api/v1/students/00000000-0000-0000-0000-000000000000",
        headers=admin_headers,
    )
    assert response.status_code == 404


def test_delete_nonexistent_student(client, admin_headers):
    """Test that deleting a non-existent student returns 404."""
    response = client.delete(
        "/api/v1/students/00000000-0000-0000-0000-000000000000",
        headers=admin_headers,
    )
    assert response.status_code == 404


# ─── Dashboard Stats Tests ────────────────────────────────────────────────────

def test_dashboard_stats(client, admin_headers):
    """Test that dashboard stats endpoint returns expected structure."""
    response = client.get(
        "/api/v1/students/dashboard/stats",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "students" in data
    assert "avgGpaByDepartment" in data
