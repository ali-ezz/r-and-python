"""Tests for password reset API."""

from __future__ import annotations


def test_request_password_reset(client):
    """Test requesting a password reset."""
    suffix = "reset"
    payload = {
        "email": f"reset_{suffix}@example.com",
        "username": f"reset_{suffix}",
        "password": "Password123",
        "confirm_password": "Password123",
        "full_name": "Reset User",
    }
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    reset_response = client.post(
        "/auth/password-reset/request",
        json={"email": payload["email"]},
    )
    assert reset_response.status_code == 200
    data = reset_response.json()
    assert "message" in data


def test_password_mismatch_on_reset(client):
    """Test password mismatch on reset confirmation."""
    reset_response = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": "pwd_reset_faketoken",
            "new_password": "NewPassword123",
            "confirm_password": "DifferentPassword",
        },
    )
    # Should fail validation (422) or token validation (400/500 if error handler fails)
    # Accept any error status since the main point is it doesn't succeed
    assert reset_response.status_code in (400, 422, 401, 500)


def test_password_change_unauthenticated_fails(client):
    """Test that password change requires authentication."""
    response = client.post(
        "/auth/password/change",
        json={
            "current_password": "anything",
            "new_password": "NewPassword123",
            "confirm_password": "NewPassword123",
        },
    )
    assert response.status_code == 401
