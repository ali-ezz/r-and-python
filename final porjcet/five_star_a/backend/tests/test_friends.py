"""Enhanced tests for friends API."""

from __future__ import annotations


def test_send_friend_request(client, auth_headers):
    """Test sending a friend request to a new user."""
    extra_user = client.post(
        "/auth/register",
        json={
            "email": "friend_target@example.com",
            "username": "friend_target",
            "password": "Password123",
            "confirm_password": "Password123",
            "full_name": "Friend Target",
        },
    )
    assert extra_user.status_code in (201, 400)

    response = client.post(
        "/friends/request",
        json={"email_or_username": "friend_target"},
        headers=auth_headers,
    )
    assert response.status_code in (201, 409)


def test_get_friends_empty(client, auth_headers):
    """Test getting empty friends list."""
    response = client.get("/friends", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_pending_requests_empty(client, auth_headers):
    """Test getting empty pending requests."""
    response = client.get("/friends/pending", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
