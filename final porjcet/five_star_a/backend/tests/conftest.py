from __future__ import annotations

import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
	Base.metadata.drop_all(bind=engine)
	Base.metadata.create_all(bind=engine)
	yield
	Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
	db = TestingSessionLocal()
	try:
		yield db
	finally:
		db.close()


@pytest.fixture
def client(db_session):
	def override_get_db():
		try:
			yield db_session
		finally:
			pass

	app.dependency_overrides[get_db] = override_get_db
	# Use context manager pattern compatible with newer starlette versions
	test_client = TestClient(app)
	yield test_client
	test_client.close()
	app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client):
	suffix = uuid4().hex[:8]
	payload = {
		"email": f"user_{suffix}@example.com",
		"username": f"user_{suffix}",
		"password": "Password123",
		"confirm_password": "Password123",
		"full_name": "Test User",
	}
	response = client.post("/auth/register", json=payload)
	assert response.status_code == 201
	return response.json()


@pytest.fixture
def auth_headers(registered_user):
	token = registered_user["token"]["access_token"]
	return {"Authorization": f"Bearer {token}"}
