"""Tests for data export API."""

from __future__ import annotations


def test_export_tasks_json(client, auth_headers):
    """Test exporting tasks as JSON."""
    project_response = client.post(
        "/projects",
        json={"name": "Export Project", "color": "#abcdef", "icon": "download"},
        headers=auth_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    client.post(
        "/tasks",
        json={"title": "Exportable Task", "project_id": project_id},
        headers=auth_headers,
    )

    response = client.get("/export/tasks/json", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "tasks" in data
    assert "task_count" in data
    assert "exported_at" in data


def test_export_tasks_csv(client, auth_headers):
    """Test exporting tasks as CSV."""
    response = client.get("/export/tasks/csv", headers=auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")


def test_export_analytics_json(client, auth_headers):
    """Test exporting analytics as JSON."""
    response = client.get("/export/analytics/json", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "period_days" in data
