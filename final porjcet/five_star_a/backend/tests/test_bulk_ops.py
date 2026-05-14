"""Tests for bulk operations API."""

from __future__ import annotations


def test_bulk_create_tasks(client, auth_headers):
    """Test bulk creating tasks."""
    project_response = client.post(
        "/projects",
        json={"name": "Bulk Project", "color": "#aabbcc", "icon": "layers"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    bulk_response = client.post(
        "/tasks/bulk/create",
        json=[
            {"title": "Bulk Task 1", "project_id": project_id},
            {"title": "Bulk Task 2", "project_id": project_id, "priority": "high"},
            {"title": "Bulk Task 3", "project_id": project_id, "priority": "urgent"},
        ],
        headers=auth_headers,
    )
    assert bulk_response.status_code == 201
    data = bulk_response.json()
    assert data["success_count"] >= 1
    assert data["failed_count"] == 0


def test_bulk_update_status(client, auth_headers):
    """Test bulk updating task status."""
    project_response = client.post(
        "/projects",
        json={"name": "Bulk Status Project", "color": "#ccddee", "icon": "check"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task1 = client.post(
        "/tasks",
        json={"title": "Status Task 1", "project_id": project_id},
        headers=auth_headers,
    )
    task2 = client.post(
        "/tasks",
        json={"title": "Status Task 2", "project_id": project_id},
        headers=auth_headers,
    )
    assert task1.status_code == 201
    assert task2.status_code == 201

    task_ids = [task1.json()["id"], task2.json()["id"]]

    bulk_response = client.patch(
        "/tasks/bulk/status",
        json={"task_ids": task_ids, "status": "in_progress"},
        headers=auth_headers,
    )
    assert bulk_response.status_code == 200
    assert bulk_response.json()["success_count"] == 2


def test_bulk_update_status_enforces_workflow(client, auth_headers):
    """Bulk status updates cannot skip todo -> in_progress -> done."""
    project_response = client.post(
        "/projects",
        json={"name": "Bulk Workflow Project", "color": "#ddeeff", "icon": "check"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task = client.post(
        "/tasks",
        json={"title": "Workflow Task", "project_id": project_id},
        headers=auth_headers,
    )
    assert task.status_code == 201

    bulk_response = client.patch(
        "/tasks/bulk/status",
        json={"task_ids": [task.json()["id"]], "status": "done"},
        headers=auth_headers,
    )
    assert bulk_response.status_code == 200
    assert bulk_response.json()["success_count"] == 0
    assert bulk_response.json()["failed_count"] == 1


def test_bulk_delete_tasks(client, auth_headers):
    """Test bulk deleting tasks."""
    project_response = client.post(
        "/projects",
        json={"name": "Bulk Delete Project", "color": "#eeffaa", "icon": "trash"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task1 = client.post(
        "/tasks",
        json={"title": "Delete Task 1", "project_id": project_id},
        headers=auth_headers,
    )
    task2 = client.post(
        "/tasks",
        json={"title": "Delete Task 2", "project_id": project_id},
        headers=auth_headers,
    )
    assert task1.status_code == 201
    assert task2.status_code == 201

    task_ids = [task1.json()["id"], task2.json()["id"]]

    bulk_response = client.request(
        "DELETE",
        "/tasks/bulk/delete",
        json={"task_ids": task_ids},
        headers=auth_headers,
    )
    assert bulk_response.status_code == 200
    assert bulk_response.json()["success_count"] == 2
