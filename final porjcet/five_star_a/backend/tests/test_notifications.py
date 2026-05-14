from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4


def create_workspace_assignee(client, admin_headers: dict, prefix: str = "notify"):
    """Employee in the same workspace as the admin (for assignee tests)."""
    suffix = uuid4().hex[:8]
    response = client.post(
        "/users",
        json={
            "email": f"{prefix}_{suffix}@example.com",
            "username": f"{prefix}_{suffix}",
            "password": "Password123",
            "confirm_password": "Password123",
            "full_name": "Notification User",
            "role": "employee",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_assignment_creates_notification(client, auth_headers):
    assignee = create_workspace_assignee(client, auth_headers, prefix="assignee")
    assignee_headers = auth_header(assignee["token"]["access_token"])

    project_response = client.post(
        "/projects",
        json={"name": "Notify Project", "description": "notification checks", "color": "#444444", "icon": "bell"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        json={
            "title": "Assigned task",
            "description": "must notify assignee",
            "priority": "high",
            "project_id": project_id,
            "assigned_to": assignee["user"]["id"],
        },
        headers=auth_headers,
    )
    assert task_response.status_code == 201
    created_task_id = task_response.json()["id"]

    notifications_response = client.get("/notifications", headers=assignee_headers)
    assert notifications_response.status_code == 200
    payload = notifications_response.json()

    assert payload["unread"] >= 1
    assert any(
        item["notification_type"] == "task_assigned" and item["related_task_id"] == created_task_id
        for item in payload["notifications"]
    )


def test_mark_notifications_read(client, auth_headers):
    assignee = create_workspace_assignee(client, auth_headers, prefix="read")
    assignee_headers = auth_header(assignee["token"]["access_token"])

    project_response = client.post(
        "/projects",
        json={"name": "Read Project", "description": "mark read", "color": "#555555", "icon": "mail"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        json={
            "title": "Mark read task",
            "description": "notification read checks",
            "priority": "medium",
            "project_id": project_id,
            "assigned_to": assignee["user"]["id"],
        },
        headers=auth_headers,
    )
    assert task_response.status_code == 201

    list_response = client.get("/notifications", headers=assignee_headers)
    assert list_response.status_code == 200
    notifications = list_response.json()["notifications"]
    unread_notification = next(item for item in notifications if not item["is_read"])

    mark_response = client.patch(f"/notifications/{unread_notification['id']}/read", headers=assignee_headers)
    assert mark_response.status_code == 200
    assert mark_response.json()["is_read"] is True

    bulk_response = client.post("/notifications/read-all", json={}, headers=assignee_headers)
    assert bulk_response.status_code == 200

    final_response = client.get("/notifications", headers=assignee_headers)
    assert final_response.status_code == 200
    assert final_response.json()["unread"] == 0


def test_completion_and_recurrence_create_notifications(client, auth_headers):
    assignee = create_workspace_assignee(client, auth_headers, prefix="done")
    assignee_headers = auth_header(assignee["token"]["access_token"])

    project_response = client.post(
        "/projects",
        json={"name": "Done Project", "description": "done notification", "color": "#223355", "icon": "check"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        json={
            "title": "Recurring completion",
            "description": "should notify creator",
            "priority": "medium",
            "project_id": project_id,
            "assigned_to": assignee["user"]["id"],
            "due_date": datetime.now(timezone.utc).isoformat(),
            "recurrence_rule": "daily",
        },
        headers=auth_headers,
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    # Must transition to 'in_progress' before 'done'
    in_progress_response = client.patch(
        f"/tasks/{task_id}/status",
        json={"status": "in_progress"},
        headers=assignee_headers,
    )
    assert in_progress_response.status_code == 200

    complete_response = client.patch(
        f"/tasks/{task_id}/status",
        json={"status": "done"},
        headers=assignee_headers,
    )
    assert complete_response.status_code == 200

    creator_notifications_response = client.get("/notifications", headers=auth_headers)
    assert creator_notifications_response.status_code == 200
    creator_notifications = creator_notifications_response.json()["notifications"]

    assert any(item["notification_type"] == "task_completed" and item["related_task_id"] == task_id for item in creator_notifications)
    assert any(item["notification_type"] == "recurring_generated" for item in creator_notifications)
