from __future__ import annotations


def test_system_dashboard_requires_admin(client):
	response = client.get("/system/dashboard")
	assert response.status_code == 401


def test_admin_can_view_system_dashboard_and_metrics(client, auth_headers):
	dashboard = client.get("/system/dashboard", headers=auth_headers)
	assert dashboard.status_code == 200
	data = dashboard.json()
	assert data["services"]["api"] == "up"
	assert "requests" in data
	assert "cache" in data
	assert "counts" in data

	metrics = client.get("/system/metrics")
	assert metrics.status_code == 200
	assert "tms_http_requests_total" in metrics.text
	assert "tms_tasks_total" in metrics.text
