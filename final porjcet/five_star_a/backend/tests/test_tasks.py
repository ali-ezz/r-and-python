from __future__ import annotations

from datetime import datetime, timedelta, timezone


def test_create_task_and_update_status(client, auth_headers):
	project_response = client.post(
		"/projects",
		json={"name": "Task Project", "description": "for tasks", "color": "#111111", "icon": "list"},
		headers=auth_headers,
	)
	assert project_response.status_code == 201
	project_id = project_response.json()["id"]

	task_response = client.post(
		"/tasks",
		json={"title": "Write tests", "description": "task desc", "priority": "medium", "project_id": project_id},
		headers=auth_headers,
	)
	assert task_response.status_code == 201
	task_id = task_response.json()["id"]

	status_response = client.patch(
		f"/tasks/{task_id}/status",
		json={"status": "in_progress"},
		headers=auth_headers,
	)
	assert status_response.status_code == 200
	assert status_response.json()["status"] == "in_progress"

	status_response = client.patch(
		f"/tasks/{task_id}/status",
		json={"status": "done"},
		headers=auth_headers,
	)
	assert status_response.status_code == 200
	assert status_response.json()["status"] == "done"

	reopen_response = client.post(
		f"/tasks/{task_id}/reopen",
		headers=auth_headers,
	)
	assert reopen_response.status_code == 400


def test_done_recurring_task_generates_next_instance(client, auth_headers):
	project_response = client.post(
		"/projects",
		json={"name": "Recurring Project", "description": "for recurrence", "color": "#223344", "icon": "repeat"},
		headers=auth_headers,
	)
	assert project_response.status_code == 201
	project_id = project_response.json()["id"]

	task_response = client.post(
		"/tasks",
		json={
			"title": "Daily planning",
			"description": "recurring task",
			"priority": "medium",
			"project_id": project_id,
			"due_date": datetime.now(timezone.utc).isoformat(),
			"recurrence_rule": "daily",
		},
		headers=auth_headers,
	)
	assert task_response.status_code == 201
	task_id = task_response.json()["id"]

	complete_response = client.patch(
		f"/tasks/{task_id}/status",
		json={"status": "in_progress"},
		headers=auth_headers,
	)
	assert complete_response.status_code == 200

	complete_response = client.patch(
		f"/tasks/{task_id}/status",
		json={"status": "done"},
		headers=auth_headers,
	)
	assert complete_response.status_code == 200

	list_response = client.get("/tasks?limit=50", headers=auth_headers)
	assert list_response.status_code == 200
	tasks = list_response.json()["tasks"]

	assert len(tasks) >= 2
	assert any(item["id"] == task_id and item["status"] == "done" for item in tasks)
	assert any(
		item["id"] != task_id and item["title"] == "Daily planning" and item["status"] == "todo"
		for item in tasks
	)


def test_recurring_task_generates_next_instance(client, auth_headers):
	project_response = client.post(
		"/projects",
		json={"name": "Recurring Project", "description": "for recurrence", "color": "#333333", "icon": "repeat"},
		headers=auth_headers,
	)
	assert project_response.status_code == 201
	project_id = project_response.json()["id"]

	due_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
	task_response = client.post(
		"/tasks",
		json={
			"title": "Daily standup prep",
			"description": "prepare notes",
			"priority": "medium",
			"project_id": project_id,
			"due_date": due_date,
			"recurrence_rule": "daily",
		},
		headers=auth_headers,
	)
	assert task_response.status_code == 201
	task_id = task_response.json()["id"]

	status_response = client.patch(
		f"/tasks/{task_id}/status",
		json={"status": "in_progress"},
		headers=auth_headers,
	)
	assert status_response.status_code == 200

	status_response = client.patch(
		f"/tasks/{task_id}/status",
		json={"status": "done"},
		headers=auth_headers,
	)
	assert status_response.status_code == 200

	list_response = client.get(f"/tasks?project_id={project_id}&limit=50", headers=auth_headers)
	assert list_response.status_code == 200
	tasks = list_response.json()["tasks"]

	matching = [item for item in tasks if item["title"] == "Daily standup prep"]
	assert len(matching) >= 2
	assert any(item["status"] == "todo" and item["recurrence_rule"] == "daily" for item in matching)
