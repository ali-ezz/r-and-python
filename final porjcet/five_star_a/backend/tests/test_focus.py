from __future__ import annotations

from datetime import date


def test_create_and_complete_goal(client, auth_headers):
    create_response = client.post(
        "/focus/goals",
        json={"goal_text": "Finish weekly planning", "target_date": date.today().isoformat()},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    goal = create_response.json()
    assert goal["goal_text"] == "Finish weekly planning"

    list_response = client.get("/focus/goals?include_completed=true", headers=auth_headers)
    assert list_response.status_code == 200
    goals_data = list_response.json()
    goals_list = goals_data.get("goals", goals_data)  # handle both old and new format
    assert any(item["id"] == goal["id"] for item in goals_list)

    complete_response = client.patch(f"/focus/goals/{goal['id']}/complete", headers=auth_headers)
    assert complete_response.status_code == 200
    assert complete_response.json()["is_completed"] is True


def test_start_and_complete_pomodoro(client, auth_headers):
    start_response = client.post(
        "/focus/pomodoro/start",
        json={"duration": 25, "break_duration": 5},
        headers=auth_headers,
    )
    assert start_response.status_code == 201
    session = start_response.json()
    assert session["is_active"] is True

    active_response = client.get("/focus/pomodoro/active", headers=auth_headers)
    assert active_response.status_code == 200
    active_data = active_response.json()
    # Response is now {session: {...}} or {session: null}
    assert active_data["session"] is not None
    assert active_data["session"]["id"] == session["id"]

    complete_response = client.post(
        f"/focus/pomodoro/{session['id']}/complete",
        json={"completed_cycles": 1},
        headers=auth_headers,
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["is_active"] is False