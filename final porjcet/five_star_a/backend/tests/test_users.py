from __future__ import annotations


def test_get_current_user_profile(client, auth_headers):
	response = client.get("/users/me", headers=auth_headers)
	assert response.status_code == 200
	data = response.json()
	assert "username" in data
	assert "email" in data


def test_search_users(client, auth_headers, registered_user):
	username = registered_user["user"]["username"]
	response = client.get(f"/users/search?q={username}", headers=auth_headers)
	assert response.status_code == 200
	data = response.json()
	assert data["total"] >= 1
