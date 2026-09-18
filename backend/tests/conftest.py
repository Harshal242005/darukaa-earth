import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def run_id():
    # Unique per test run so reruns don't collide with existing DB rows
    return uuid.uuid4().hex[:8]


@pytest.fixture
def auth_headers(client, run_id):
    email = f"test-{run_id}@example.com"
    password = "password123"

    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Test"},
    )
    assert r.status_code in (201, 400), r.text

    r = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
