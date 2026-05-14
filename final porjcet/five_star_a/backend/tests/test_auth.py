from __future__ import annotations

from uuid import uuid4


def test_register(client):
	suffix = uuid4().hex[:8]
	payload = {
		"email": f"new_{suffix}@example.com",
		"username": f"new_{suffix}",
		"password": "Password123",
		"confirm_password": "Password123",
		"full_name": "New User",
	}
	response = client.post("/auth/register", json=payload)
	assert response.status_code == 201
	data = response.json()
	assert "token" in data
	assert "access_token" in data["token"]
	assert data["user"]["role"] == "admin"


def test_register_domainless_email(client):
    """Test registration with domainless email (e.g. user@internal)."""
    response = client.post(
        "/auth/register",
        json={
            "email": "user@internal",
            "username": "domainlessuser",
            "password": "password123",
            "confirm_password": "password123",
            "full_name": "Domainless User"
        }
    )
    assert response.status_code == 201
    assert response.json()["user"]["email"] == "user@internal"

def test_login(client):
	suffix = uuid4().hex[:8]
	payload = {
		"email": f"login_{suffix}@example.com",
		"username": f"login_{suffix}",
		"password": "Password123",
		"confirm_password": "Password123",
		"full_name": "Login User",
	}
	register_response = client.post("/auth/register", json=payload)
	assert register_response.status_code == 201

	login_response = client.post(
		"/auth/login",
		json={"username": payload["username"], "password": payload["password"]},
	)
	assert login_response.status_code == 200
	assert "access_token" in login_response.json()
