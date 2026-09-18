POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [77.5, 12.9],
            [77.6, 12.9],
            [77.6, 13.0],
            [77.5, 13.0],
            [77.5, 12.9],
        ]
    ],
}


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_projects_require_auth(client):
    r = client.get("/api/projects")
    assert r.status_code == 401


def test_register_login_me(client, run_id):
    email = f"flow-{run_id}@example.com"
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": "Flow"},
    )
    assert r.status_code == 201
    assert "access_token" in r.json()

    r = client.post(
        "/api/auth/login",
        data={"username": email, "password": "password123"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == email


def test_create_project_and_site(client, auth_headers):
    r = client.post(
        "/api/projects",
        headers=auth_headers,
        json={"name": "Test Project", "project_type": "carbon"},
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    r = client.post(
        f"/api/projects/{pid}/sites",
        headers=auth_headers,
        json={"name": "Block A", "geometry": POLYGON},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["area_hectares"] > 0
    assert body["geometry"]["type"] == "Polygon"


def test_analytics_returns_series(client, auth_headers):
    pid = client.post(
        "/api/projects",
        headers=auth_headers,
        json={"name": "Analytics Project"},
    ).json()["id"]

    sid = client.post(
        f"/api/projects/{pid}/sites",
        headers=auth_headers,
        json={"name": "S1", "geometry": POLYGON},
    ).json()["id"]

    r = client.get(f"/api/sites/{sid}/analytics", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["series"]) == 24
    assert body["total_carbon_tco2e"] > 0
    assert 0 <= body["avg_ndvi"] <= 1


def test_rejects_non_polygon(client, auth_headers):
    pid = client.post(
        "/api/projects",
        headers=auth_headers,
        json={"name": "Bad Project"},
    ).json()["id"]

    r = client.post(
        f"/api/projects/{pid}/sites",
        headers=auth_headers,
        json={
            "name": "X",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
        },
    )
    assert r.status_code == 422
