"""Registration, login and token handling."""

from fastapi.testclient import TestClient

from tests.conftest import auth_header, register


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_returns_token_and_user(client: TestClient) -> None:
    data = register(client, username="alice", email="alice@example.com")
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["role"] == "job_seeker"
    assert "password" not in data["user"]
    assert "hashed_password" not in data["user"]


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    register(client, username="alice", email="alice@example.com")
    response = client.post(
        "/api/auth/register",
        json={
            "username": "alice2",
            "email": "alice@example.com",
            "password": "password123",
            "role": "job_seeker",
        },
    )
    assert response.status_code == 409


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "username": "bob",
            "email": "bob@example.com",
            "password": "short",
            "role": "job_seeker",
        },
    )
    assert response.status_code == 422


def test_cannot_self_register_as_admin(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "username": "sneaky",
            "email": "sneaky@example.com",
            "password": "password123",
            "role": "admin",
        },
    )
    assert response.status_code == 422


def test_login_is_case_insensitive_on_email(client: TestClient) -> None:
    register(client, username="carol", email="carol@example.com")
    response = client.post(
        "/api/auth/login",
        json={"email": "CAROL@example.com", "password": "password123"},
    )
    assert response.status_code == 200


def test_login_rejects_wrong_password(client: TestClient) -> None:
    register(client, username="dave", email="dave@example.com")
    response = client.post(
        "/api/auth/login", json={"email": "dave@example.com", "password": "wrong-one"}
    )
    assert response.status_code == 401


def test_me_requires_a_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_a_garbage_token(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers=auth_header("not-a-real-token"))
    assert response.status_code == 401


def test_me_includes_the_matching_profile(client: TestClient, seeker: dict) -> None:
    response = client.get("/api/auth/me", headers=auth_header(seeker["token"]))
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "job_seeker"
    assert body["job_seeker_profile"]["full_name"] == "Sam Seeker"
    assert body["employer_profile"] is None


def test_change_password_then_login_with_it(client: TestClient) -> None:
    token = register(client, username="erin", email="erin@example.com")["access_token"]
    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": "password123", "new_password": "a-better-password"},
        headers=auth_header(token),
    )
    assert changed.status_code == 200

    assert (
        client.post(
            "/api/auth/login",
            json={"email": "erin@example.com", "password": "password123"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "erin@example.com", "password": "a-better-password"},
        ).status_code
        == 200
    )


def test_deactivated_user_cannot_use_their_token(
    client: TestClient, admin: dict, seeker: dict
) -> None:
    me = client.get("/api/auth/me", headers=auth_header(seeker["token"]))
    user_id = me.json()["user"]["id"]

    client.patch(
        f"/api/admin/users/{user_id}/active",
        params={"is_active": False},
        headers=auth_header(admin["token"]),
    )
    assert client.get("/api/auth/me", headers=auth_header(seeker["token"])).status_code == 403
