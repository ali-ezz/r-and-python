"""
Comprehensive authentication and user management tests.

Tests cover: registration, login, token validation, protected routes,
role restrictions, password validation, and admin user management.
"""

import pytest


def test_register_user(client):
    """Test successful user registration with valid data."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "Password1", "full_name": "Test User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["full_name"] == "Test User"
    assert "id" in data
    assert data["role"] == "STUDENT"


def test_register_derives_name_from_email(client):
    """Test that full_name is derived from email if not provided."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "john.doe@example.com", "password": "Password1"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "John Doe"


def test_register_duplicate_user(client):
    """Test that registering with an existing email returns 400."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "duplicate@example.com", "password": "Password1"},
    )
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "duplicate@example.com", "password": "Password1"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_register_weak_password_no_uppercase(client):
    """Test that passwords without uppercase letters are rejected (422)."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "weak1@example.com", "password": "password1"},
    )
    assert response.status_code == 422


def test_register_weak_password_no_digit(client):
    """Test that passwords without digits are rejected (422)."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "weak2@example.com", "password": "Password"},
    )
    assert response.status_code == 422


def test_register_short_password(client):
    """Test that passwords shorter than 8 characters are rejected (422)."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "weak3@example.com", "password": "Pa1"},
    )
    assert response.status_code == 422


def test_register_invalid_email(client):
    """Test that invalid email format is rejected (422)."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "Password1"},
    )
    assert response.status_code == 422


def test_login_user(client):
    """Test successful login returns access token and user data."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "Password1", "full_name": "Login User"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "Password1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "accessToken" in data["data"]
    assert data["data"]["user"]["email"] == "login@example.com"
    assert data["data"]["user"]["fullName"] == "Login User"


def test_login_invalid_credentials(client):
    """Test that wrong credentials return 401."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_read_users_me(client):
    """Test /me endpoint returns authenticated user's full data."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "me@example.com", "password": "Password1", "full_name": "Me User"},
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "me@example.com", "password": "Password1"},
    )
    token = login_response.json()["data"]["accessToken"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    user = response.json()["data"]["user"]
    assert user["email"] == "me@example.com"
    assert user["fullName"] == "Me User"


def test_me_requires_auth(client):
    """Test that /me without token returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_invalid_token(client):
    """Test that /me with invalid token returns 401."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"},
    )
    assert response.status_code == 401


def test_admin_list_users(client):
    """Test admin can list all users with profile data."""
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@sms.edu", "password": "Admin@2026"},
    )
    token = login_response.json()["data"]["accessToken"]

    response = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data
    assert data["total"] >= 1


def test_student_cannot_list_users(client):
    """Test that students cannot access the users list (403)."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "nonadmin@example.com", "password": "Password1"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "nonadmin@example.com", "password": "Password1"},
    )
    token = login.json()["data"]["accessToken"]

    response = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_admin_update_user_role(client):
    """Test admin can change a user's role."""
    # Register a student
    client.post(
        "/api/v1/auth/register",
        json={"email": "promote@example.com", "password": "Password1"},
    )

    # Login as admin
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@sms.edu", "password": "Admin@2026"},
    )
    admin_token = admin_login.json()["data"]["accessToken"]

    # Get users to find the student's ID
    users_resp = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    users = users_resp.json()["data"]
    target = next(u for u in users if u["email"] == "promote@example.com")

    # Promote to INSTRUCTOR
    response = client.put(
        f"/api/v1/auth/users/{target['id']}",
        json={"role": "INSTRUCTOR"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["role"] == "INSTRUCTOR"


def test_admin_deactivate_user(client):
    """Test admin can deactivate a user."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "deactivate@example.com", "password": "Password1"},
    )

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@sms.edu", "password": "Admin@2026"},
    )
    admin_token = admin_login.json()["data"]["accessToken"]

    users_resp = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    target = next(u for u in users_resp.json()["data"] if u["email"] == "deactivate@example.com")

    response = client.put(
        f"/api/v1/auth/users/{target['id']}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["isActive"] is False


def test_refresh_token(client):
    """Test token refresh returns a new access token."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "password": "Password1"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "refresh@example.com", "password": "Password1"},
    )
    token = login.json()["data"]["accessToken"]

    response = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "accessToken" in response.json()["data"]
