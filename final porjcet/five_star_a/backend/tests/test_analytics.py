"""Enhanced tests for analytics API."""

from __future__ import annotations


def test_weekly_summary(client, auth_headers):
    """Test weekly summary endpoint."""
    response = client.get("/analytics/weekly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Response model has: total_tasks, completed_tasks, overdue_tasks, completion_rate, week_start, week_end
    assert "total_tasks" in data or "tasks_created" in data


def test_streak_info(client, auth_headers):
    """Test streak info endpoint."""
    response = client.get("/analytics/streaks", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "current_streak" in data
    assert "longest_streak" in data


def test_productivity_score(client, auth_headers):
    """Test productivity score endpoint."""
    response = client.get("/analytics/productivity-score", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "score" in data
    assert isinstance(data["score"], (int, float))


def test_monthly_trend(client, auth_headers):
    """Test monthly trend endpoint."""
    response = client.get("/analytics/monthly-trend", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_goals_completion(client, auth_headers):
    """Test goals completion rate endpoint."""
    response = client.get("/analytics/goals-completion", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_goals" in data or "completion_rate" in data
