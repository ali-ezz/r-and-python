"""Tests for rate limiting middleware."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.middleware.rate_limiter import RateLimitMiddleware, _rate_limits


class TestRateLimiting:
    """Test API rate limiting functionality."""

    @pytest.fixture
    def app(self):
        """Create test app with rate limiting."""
        app = FastAPI()
        
        # Add a simple test endpoint
        @app.get("/test")
        def test_endpoint():
            return {"status": "ok"}
        
        @app.get("/health")
        def health():
            return {"status": "healthy"}
        
        # Add rate limiting middleware (low limit for testing)
        app.add_middleware(RateLimitMiddleware, rate_limit=5, window=60)
        
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture(autouse=True)
    def clear_rate_limits(self):
        """Clear rate limit state before each test."""
        _rate_limits.clear()
        yield
        _rate_limits.clear()

    def test_rate_limit_allows_requests_under_limit(self, client):
        """Should allow requests under the rate limit."""
        for _ in range(5):
            response = client.get("/test")
            assert response.status_code == 200
            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers

    def test_rate_limit_blocks_excess_requests(self, client):
        """Should block requests exceeding the rate limit."""
        # Make requests up to limit
        for i in range(5):
            response = client.get("/test")
            assert response.status_code == 200, f"Request {i+1} failed unexpectedly"
        
        # Next request should be rate limited
        response = client.get("/test")
        assert response.status_code == 429
        data = response.json()
        assert "Rate limit exceeded" in data.get("detail", "")
        assert "retry_after" in data

    def test_rate_limit_includes_retry_header(self, client):
        """Rate limited response should include Retry-After header."""
        # Exhaust rate limit
        for _ in range(5):
            client.get("/test")
        
        # Check rate limited response
        response = client.get("/test")
        assert response.status_code == 429
        assert "Retry-After" in response.headers

    def test_rate_limit_skips_health_check(self, client):
        """Health check endpoint should be exempt from rate limiting."""
        # Make many health check requests
        for _ in range(20):
            response = client.get("/health")
            assert response.status_code == 200

    def test_rate_limit_skips_docs(self, client):
        """Documentation endpoints should be exempt from rate limiting."""
        # Make many doc requests
        for _ in range(20):
            response = client.get("/docs")
            # May be 200 or 404 depending on setup, but should not be 429
            assert response.status_code != 429

    def test_rate_limit_decrements_remaining(self, client):
        """Remaining count should decrease with each request."""
        responses = []
        for i in range(5):
            response = client.get("/test")
            assert response.status_code == 200, f"Request {i+1} failed"
            responses.append(response)
        
        # Check decreasing remaining count
        for i, response in enumerate(responses):
            remaining = int(response.headers.get("X-RateLimit-Remaining", 0))
            expected = 4 - i  # Starts at 4, decreases to 0
            assert remaining == expected, f"Request {i+1}: expected {expected}, got {remaining}"

    def test_rate_limit_by_path(self, client):
        """Rate limiting should be per-path, not global."""
        # Exhaust limit for /test
        for _ in range(5):
            client.get("/test")
        
        # /test should be limited
        response = client.get("/test")
        assert response.status_code == 429
