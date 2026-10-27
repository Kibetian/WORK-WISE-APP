"""Profiles, uploads, and the administrator surface."""

import io

from fastapi.testclient import TestClient

from tests.conftest import auth_header, create_job, register


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------
def test_profile_is_created_once_then_patched(client: TestClient, seeker: dict) -> None:
    duplicate = client.post(
        "/api/jobseekers/me",
        json={"full_name": "Sam Again"},
        headers=auth_header(seeker["token"]),
    )
    assert duplicate.status_code == 409

    patched = client.patch(
        "/api/jobseekers/me",
        json={"headline": "Backend engineer", "salary_expectation": 90000},
        headers=auth_header(seeker["token"]),
    )
    assert patched.status_code == 200
    assert patched.json()["headline"] == "Backend engineer"
    assert patched.json()["full_name"] == "Sam Seeker"


def test_employer_cannot_create_a_job_seeker_profile(
    client: TestClient, employer: dict
) -> None:
    response = client.post(
        "/api/jobseekers/me",
        json={"full_name": "Not Allowed"},
        headers=auth_header(employer["token"]),
    )
    assert response.status_code == 403


def test_employer_cannot_self_verify(client: TestClient) -> None:
    token = register(
        client, username="selfie", email="selfie@co.test", role="employer"
    )["access_token"]
    client.post(
        "/api/employers/me",
        json={"company_name": "Selfie Co"},
        headers=auth_header(token),
    )
    # ``verified`` is not part of the update schema, so it is ignored outright.
    response = client.patch(
        "/api/employers/me",
        json={"company_name": "Selfie Co", "verified": True},
        headers=auth_header(token),
    )
    assert response.status_code == 200
    assert response.json()["verified"] is False


def test_candidate_directory_is_staff_only(client: TestClient, seeker: dict) -> None:
    assert client.get("/api/jobseekers").status_code == 401
    assert (
        client.get("/api/jobseekers", headers=auth_header(seeker["token"])).status_code
        == 403
    )


def test_employer_can_browse_candidates(
    client: TestClient, employer: dict, seeker: dict
) -> None:
    response = client.get(
        "/api/jobseekers", params={"q": "Python"}, headers=auth_header(employer["token"])
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1


# ---------------------------------------------------------------------------
# Uploads
# ---------------------------------------------------------------------------
def test_document_upload_and_delete(client: TestClient, seeker: dict) -> None:
    upload = client.post(
        "/api/files/documents",
        files={"file": ("cv.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        data={"document_type": "resume"},
        headers=auth_header(seeker["token"]),
    )
    assert upload.status_code == 201, upload.text
    document = upload.json()
    assert document["status"] == "pending"
    assert document["url"].startswith("/uploads/documents/")

    listed = client.get("/api/jobseekers/me/documents", headers=auth_header(seeker["token"]))
    assert len(listed.json()) == 1

    deleted = client.delete(
        f"/api/files/documents/{document['id']}", headers=auth_header(seeker["token"])
    )
    assert deleted.status_code == 200
    assert client.get(
        "/api/jobseekers/me/documents", headers=auth_header(seeker["token"])
    ).json() == []


def test_upload_rejects_unsupported_type(client: TestClient, seeker: dict) -> None:
    response = client.post(
        "/api/files/documents",
        files={"file": ("payload.exe", io.BytesIO(b"MZ"), "application/x-msdownload")},
        headers=auth_header(seeker["token"]),
    )
    assert response.status_code == 415


def test_profile_image_upload_sets_the_url(client: TestClient, seeker: dict) -> None:
    response = client.post(
        "/api/files/profile-image",
        files={"file": ("me.png", io.BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")},
        headers=auth_header(seeker["token"]),
    )
    assert response.status_code == 200
    url = response.json()["url"]

    profile = client.get("/api/jobseekers/me", headers=auth_header(seeker["token"]))
    assert profile.json()["profile_image_url"] == url


def test_seeker_cannot_delete_another_seekers_document(
    client: TestClient, seeker: dict
) -> None:
    document = client.post(
        "/api/files/documents",
        files={"file": ("cv.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        headers=auth_header(seeker["token"]),
    ).json()

    other = register(client, username="other", email="other@example.com")["access_token"]
    client.post(
        "/api/jobseekers/me", json={"full_name": "Other Person"}, headers=auth_header(other)
    )
    response = client.delete(
        f"/api/files/documents/{document['id']}", headers=auth_header(other)
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
def test_admin_surface_is_closed_to_everyone_else(
    client: TestClient, seeker: dict, employer: dict
) -> None:
    for token in (seeker["token"], employer["token"]):
        assert client.get("/api/admin/stats", headers=auth_header(token)).status_code == 403
    assert client.get("/api/admin/stats").status_code == 401


def test_admin_stats_count_the_world(
    client: TestClient, admin: dict, employer: dict, seeker: dict
) -> None:
    create_job(client, employer["token"])
    stats = client.get("/api/admin/stats", headers=auth_header(admin["token"]))
    assert stats.status_code == 200
    body = stats.json()
    assert body["employers"] == 1
    assert body["job_seekers"] == 1
    assert body["verified_employers"] == 1
    assert body["total_jobs"] == 1
    assert body["open_jobs"] == 1


def test_admin_verifies_a_job_seeker(
    client: TestClient, admin: dict, seeker: dict
) -> None:
    profile_id = seeker["profile"]["id"]
    response = client.patch(
        f"/api/admin/jobseekers/{profile_id}/verification",
        params={"verified": True},
        headers=auth_header(admin["token"]),
    )
    assert response.status_code == 200
    assert (
        client.get("/api/jobseekers/me", headers=auth_header(seeker["token"])).json()[
            "verified"
        ]
        is True
    )


def test_admin_reviews_a_document(client: TestClient, admin: dict, seeker: dict) -> None:
    document = client.post(
        "/api/files/documents",
        files={"file": ("cv.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        headers=auth_header(seeker["token"]),
    ).json()

    pending = client.get("/api/admin/documents", headers=auth_header(admin["token"]))
    assert pending.json()["total"] == 1
    assert pending.json()["items"][0]["job_seeker_name"] == "Sam Seeker"

    reviewed = client.patch(
        f"/api/admin/documents/{document['id']}/review",
        json={"status": "approved", "review_note": "Looks right"},
        headers=auth_header(admin["token"]),
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "approved"
    assert client.get("/api/admin/documents", headers=auth_header(admin["token"])).json()[
        "total"
    ] == 0


def test_review_status_cannot_be_pending(
    client: TestClient, admin: dict, seeker: dict
) -> None:
    document = client.post(
        "/api/files/documents",
        files={"file": ("cv.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        headers=auth_header(seeker["token"]),
    ).json()
    response = client.patch(
        f"/api/admin/documents/{document['id']}/review",
        json={"status": "pending"},
        headers=auth_header(admin["token"]),
    )
    assert response.status_code == 422


def test_admin_cannot_deactivate_themselves(client: TestClient, admin: dict) -> None:
    response = client.patch(
        f"/api/admin/users/{admin['user']['id']}/active",
        params={"is_active": False},
        headers=auth_header(admin["token"]),
    )
    assert response.status_code == 400


def test_admin_user_list_includes_profile_names(
    client: TestClient, admin: dict, employer: dict, seeker: dict
) -> None:
    response = client.get(
        "/api/admin/users", params={"role": "employer"}, headers=auth_header(admin["token"])
    )
    assert response.status_code == 200
    entry = response.json()["items"][0]
    assert entry["display_name"] == "Acme Corp"
    assert entry["verified"] is True
