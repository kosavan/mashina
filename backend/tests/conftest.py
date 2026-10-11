import pytest
from fastapi.testclient import TestClient
from backend.app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(tmp_path, bootstrap_token="test-bootstrap")
    with TestClient(app) as c:
        result = c.post(
            "/api/v1/setup",
            json={
                "username": "owner",
                "password": "test-only-password",
                "bootstrap_token": "test-bootstrap",
            },
        )
        assert result.status_code == 200, result.text
        c.headers["X-CSRF-Token"] = result.json()["csrf"]
        yield c
