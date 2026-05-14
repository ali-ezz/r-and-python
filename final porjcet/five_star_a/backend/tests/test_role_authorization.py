"""Tests for role-based authorization and workspace isolation."""

from __future__ import annotations

from uuid import uuid4


def _register_admin(client, suffix: str | None = None):
	s = suffix or str(uuid4())[:8]
	payload = {
		"email": f"admin_{s}@example.com",
		"username": f"admin_{s}",
		"password": "Password123",
		"confirm_password": "Password123",
		"full_name": f"Admin {s}",
	}
	reg = client.post("/auth/register", json=payload)
	assert reg.status_code == 201
	assert reg.json()["user"]["role"] == "admin"
	token = reg.json()["token"]["access_token"]
	return {"Authorization": f"Bearer {token}"}, reg.json()["user"]["id"]


def _create_user_in_workspace(client, admin_headers: dict, username: str, role: str):
	s = str(uuid4())[:8]
	payload = {
		"email": f"{username}_{s}@example.com",
		"username": f"{username}_{s}",
		"password": "Password123",
		"confirm_password": "Password123",
		"full_name": username,
		"role": role,
	}
	r = client.post("/users", json=payload, headers=admin_headers)
	assert r.status_code == 201
	return {"Authorization": f"Bearer {r.json()['token']['access_token']}"}, r.json()["user"]["id"]


def test_admin_can_delete_project(client):
	admin_headers, _ = _register_admin(client)
	proj = client.post("/projects", json={"name": "Admin Proj", "color": "#ff0000"}, headers=admin_headers)
	assert proj.status_code == 201
	project_id = proj.json()["id"]
	response = client.delete(f"/projects/{project_id}", headers=admin_headers)
	assert response.status_code == 200


def test_employee_cannot_delete_project(client):
	admin_headers, _ = _register_admin(client)
	emp_headers, _ = _create_user_in_workspace(client, admin_headers, "emp", "employee")
	proj = client.post("/projects", json={"name": "Company Proj", "color": "#00ff00"}, headers=admin_headers)
	assert proj.status_code == 201
	project_id = proj.json()["id"]
	response = client.delete(f"/projects/{project_id}", headers=emp_headers)
	assert response.status_code == 403


def test_employee_cannot_create_project(client):
	admin_headers, _ = _register_admin(client)
	emp_headers, _ = _create_user_in_workspace(client, admin_headers, "emp2", "employee")
	response = client.post("/projects", json={"name": "Emp Proj", "color": "#0000ff"}, headers=emp_headers)
	assert response.status_code == 403


def test_manager_cannot_create_edit_or_delete_project(client):
	admin_headers, _ = _register_admin(client)
	pm_headers, _ = _create_user_in_workspace(client, admin_headers, "pm", "project_manager")

	proj = client.post("/projects", json={"name": "Admin-owned", "color": "#FFFF00"}, headers=admin_headers)
	assert proj.status_code == 201
	project_id = proj.json()["id"]

	create = client.post("/projects", json={"name": "PM Proj", "color": "#CCCCCC"}, headers=pm_headers)
	assert create.status_code == 403

	update = client.put(f"/projects/{project_id}", json={"name": "Updated"}, headers=pm_headers)
	assert update.status_code == 403

	delete = client.delete(f"/projects/{project_id}", headers=pm_headers)
	assert delete.status_code == 403


def test_manager_can_list_and_get_workspace_projects(client):
	admin_headers, _ = _register_admin(client)
	pm_headers, _ = _create_user_in_workspace(client, admin_headers, "pm2", "project_manager")
	proj = client.post("/projects", json={"name": "Shared vis", "color": "#AABBCC"}, headers=admin_headers)
	assert proj.status_code == 201
	project_id = proj.json()["id"]

	lst = client.get("/projects", headers=pm_headers)
	assert lst.status_code == 200
	assert lst.json()["total"] >= 1

	one = client.get(f"/projects/{project_id}", headers=pm_headers)
	assert one.status_code == 200


def test_manager_can_create_but_not_delete_tasks(client):
	admin_headers, _ = _register_admin(client)
	pm_headers, _ = _create_user_in_workspace(client, admin_headers, "pm_task", "project_manager")
	proj = client.post("/projects", json={"name": "Task Ops", "color": "#AA00AA"}, headers=admin_headers)
	assert proj.status_code == 201

	task = client.post("/tasks", json={"title": "Manager task", "project_id": proj.json()["id"]}, headers=pm_headers)
	assert task.status_code == 201

	delete = client.delete(f"/tasks/{task.json()['id']}", headers=pm_headers)
	assert delete.status_code == 403


def test_self_registered_users_have_separate_workspaces(client):
	"""Two public signups must not see each other's projects."""
	h1, _ = _register_admin(client, "a1")
	h2, _ = _register_admin(client, "a2")
	p1 = client.post("/projects", json={"name": "Ws1", "color": "#111111"}, headers=h1)
	assert p1.status_code == 201
	l2 = client.get("/projects", headers=h2)
	assert l2.status_code == 200
	ids = [p["id"] for p in l2.json().get("projects", [])]
	assert p1.json()["id"] not in ids


def test_employee_can_only_update_assigned_task_status(client):
	admin_headers, _ = _register_admin(client)
	emp_headers, emp_id = _create_user_in_workspace(client, admin_headers, "worker", "employee")
	project = client.post("/projects", json={"name": "Employee Scope", "color": "#123456"}, headers=admin_headers)
	assert project.status_code == 201
	task = client.post(
		"/tasks",
		json={"title": "Assigned work", "project_id": project.json()["id"], "assigned_to": emp_id},
		headers=admin_headers,
	)
	assert task.status_code == 201
	task_id = task.json()["id"]

	title_update = client.put(f"/tasks/{task_id}", json={"title": "Not allowed"}, headers=emp_headers)
	assert title_update.status_code == 403

	status_update = client.put(f"/tasks/{task_id}", json={"status": "in_progress"}, headers=emp_headers)
	assert status_update.status_code == 200
	assert status_update.json()["status"] == "in_progress"


def test_put_task_status_cannot_bypass_workflow(client):
	admin_headers, _ = _register_admin(client)
	project = client.post("/projects", json={"name": "Workflow Guard", "color": "#654321"}, headers=admin_headers)
	assert project.status_code == 201
	task = client.post(
		"/tasks",
		json={"title": "Guarded work", "project_id": project.json()["id"]},
		headers=admin_headers,
	)
	assert task.status_code == 201

	direct_done = client.put(f"/tasks/{task.json()['id']}", json={"status": "done"}, headers=admin_headers)
	assert direct_done.status_code == 400
