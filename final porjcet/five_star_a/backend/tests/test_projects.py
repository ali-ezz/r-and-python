from __future__ import annotations


def test_create_and_list_projects(client, auth_headers):
	create_response = client.post(
		"/projects",
		json={"name": "Test Project", "description": "A project", "color": "#222222", "icon": "briefcase"},
		headers=auth_headers,
	)
	assert create_response.status_code == 201

	list_response = client.get("/projects", headers=auth_headers)
	assert list_response.status_code == 200
	data = list_response.json()
	assert data["total"] >= 1
