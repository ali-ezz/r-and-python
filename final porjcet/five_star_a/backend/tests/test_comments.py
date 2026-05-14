"""Tests for task comments API."""

from __future__ import annotations


def test_create_and_list_comments(client, auth_headers):
    """Test creating and listing task comments."""
    project_response = client.post(
        "/projects",
        json={"name": "Comment Project", "color": "#334455", "icon": "chat"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        json={"title": "Comment Task", "project_id": project_id},
        headers=auth_headers,
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    comment_response = client.post(
        f"/tasks/{task_id}/comments",
        json={"content": "This is a test comment"},
        headers=auth_headers,
    )
    assert comment_response.status_code == 201
    assert comment_response.json()["content"] == "This is a test comment"

    list_response = client.get(f"/tasks/{task_id}/comments", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 1


def test_update_comment(client, auth_headers):
    """Test updating a comment."""
    project_response = client.post(
        "/projects",
        json={"name": "Update Project", "color": "#556677", "icon": "edit"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        json={"title": "Update Task", "project_id": project_id},
        headers=auth_headers,
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    comment_response = client.post(
        f"/tasks/{task_id}/comments",
        json={"content": "Original comment"},
        headers=auth_headers,
    )
    assert comment_response.status_code == 201
    comment_id = comment_response.json()["id"]

    update_response = client.put(
        f"/tasks/comments/{comment_id}",
        json={"content": "Updated comment"},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["content"] == "Updated comment"


def test_delete_comment(client, auth_headers):
    """Test deleting a comment."""
    project_response = client.post(
        "/projects",
        json={"name": "Delete Project", "color": "#778899", "icon": "trash"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        json={"title": "Delete Task", "project_id": project_id},
        headers=auth_headers,
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    comment_response = client.post(
        f"/tasks/{task_id}/comments",
        json={"content": "To be deleted"},
        headers=auth_headers,
    )
    assert comment_response.status_code == 201
    comment_id = comment_response.json()["id"]

    delete_response = client.delete(f"/tasks/comments/{comment_id}", headers=auth_headers)
    assert delete_response.status_code == 200
