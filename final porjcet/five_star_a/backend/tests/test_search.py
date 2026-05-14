"""Tests for advanced search API."""

from __future__ import annotations


def test_search_across_entities(client, auth_headers):
    """Test searching across tasks and projects."""
    client.post(
        "/projects",
        json={"name": "Search Project Alpha", "color": "#ff0000", "icon": "search"},
        headers=auth_headers,
    )

    response = client.get("/search?q=alpha", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "total" in data
    assert "tasks" in data
    assert "projects" in data


def test_search_empty_query(client, auth_headers):
    """Test search with empty query fails validation."""
    response = client.get("/search?q=", headers=auth_headers)
    assert response.status_code in (422, 400)


def test_search_no_results(client, auth_headers):
    """Test search that returns no results."""
    response = client.get("/search?q=xyznonexistent123", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert len(data["tasks"]) == 0
    assert len(data["projects"]) == 0
