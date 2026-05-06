"""
Admin endpoint tests: health check, audit logs, system stats.
"""

import pytest


@pytest.fixture
def admin_headers(client):
    """Authenticate as admin."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@sms.edu", "password": "Admin@2026"},
    )
    token = response.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_headers(client):
    """Authenticate as a student."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "admin_test_student@example.com", "password": "Password1"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_test_student@example.com", "password": "Password1"},
    )
    token = response.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


# ─── Health Check ─────────────────────────────────────────────────────────────

def test_health_check(client):
    """Test public health check endpoint returns service status."""
    response = client.get("/api/v1/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data["services"]
    assert "redis" in data["services"]


# ─── Audit Logs ───────────────────────────────────────────────────────────────

def test_admin_audit_logs(client, admin_headers):
    """Test admin can view audit logs."""
    response = client.get(
        "/api/v1/admin/audit-logs",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data


def test_admin_audit_logs_filter_by_action(client, admin_headers):
    """Test filtering audit logs by action type."""
    response = client.get(
        "/api/v1/admin/audit-logs?action=CREATE",
        headers=admin_headers,
    )
    assert response.status_code == 200
    entries = response.json()["data"]
    for entry in entries:
        assert entry["action"] == "CREATE"


def test_student_cannot_view_audit_logs(client, student_headers):
    """Test students are blocked from audit log access (403)."""
    response = client.get(
        "/api/v1/admin/audit-logs",
        headers=student_headers,
    )
    assert response.status_code == 403


# ─── System Stats ─────────────────────────────────────────────────────────────

def test_admin_system_stats(client, admin_headers):
    """Test admin can view system statistics."""
    response = client.get(
        "/api/v1/admin/system-stats",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "users" in data
    assert "students" in data
    assert "services" in data
    assert data["users"]["total"] >= 1


def test_student_cannot_view_system_stats(client, student_headers):
    """Test students are blocked from system stats (403)."""
    response = client.get(
        "/api/v1/admin/system-stats",
        headers=student_headers,
    )
    assert response.status_code == 403
