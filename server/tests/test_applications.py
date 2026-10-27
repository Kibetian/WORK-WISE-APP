"""Applying for jobs and moving candidates through the pipeline."""

from fastapi.testclient import TestClient

from tests.conftest import auth_header, create_job, register


def test_apply_and_see_it_in_my_applications(
    client: TestClient, employer: dict, seeker: dict
) -> None:
    job = create_job(client, employer["token"])

    applied = client.post(
        "/api/applications",
        json={"job_id": job["id"], "cover_letter": "I would like to be considered."},
        headers=auth_header(seeker["token"]),
    )
    assert applied.status_code == 201, applied.text
    assert applied.json()["status"] == "applied"
    assert applied.json()["job"]["company_name"] == "Acme Corp"
    # The original app never set these; make sure they are populated.
    assert applied.json()["created_at"]

    mine = client.get("/api/applications/me", headers=auth_header(seeker["token"]))
    assert mine.status_code == 200
    assert mine.json()["total"] == 1


def test_cannot_apply_twice(client: TestClient, employer: dict, seeker: dict) -> None:
    job = create_job(client, employer["token"])
    body = {"job_id": job["id"]}
    assert (
        client.post(
            "/api/applications", json=body, headers=auth_header(seeker["token"])
        ).status_code
        == 201
    )
    second = client.post(
        "/api/applications", json=body, headers=auth_header(seeker["token"])
    )
    assert second.status_code == 409


def test_cannot_apply_to_a_closed_job(
    client: TestClient, employer: dict, seeker: dict
) -> None:
    job = create_job(client, employer["token"])
    client.patch(
        f"/api/jobs/{job['id']}",
        json={"status": "closed"},
        headers=auth_header(employer["token"]),
    )
    response = client.post(
        "/api/applications",
        json={"job_id": job["id"]},
        headers=auth_header(seeker["token"]),
    )
    assert response.status_code == 409


def test_applying_without_a_profile_is_rejected(client: TestClient, employer: dict) -> None:
    job = create_job(client, employer["token"])
    token = register(client, username="noprofile", email="np@example.com")["access_token"]
    response = client.post(
        "/api/applications", json={"job_id": job["id"]}, headers=auth_header(token)
    )
    assert response.status_code == 404


def test_employer_cannot_apply(client: TestClient, employer: dict) -> None:
    job = create_job(client, employer["token"])
    response = client.post(
        "/api/applications",
        json={"job_id": job["id"]},
        headers=auth_header(employer["token"]),
    )
    assert response.status_code == 403


def test_has_applied_flag_on_the_job_listing(
    client: TestClient, employer: dict, seeker: dict
) -> None:
    job = create_job(client, employer["token"])
    before = client.get(f"/api/jobs/{job['id']}", headers=auth_header(seeker["token"]))
    assert before.json()["has_applied"] is False

    client.post(
        "/api/applications",
        json={"job_id": job["id"]},
        headers=auth_header(seeker["token"]),
    )
    after = client.get(f"/api/jobs/{job['id']}", headers=auth_header(seeker["token"]))
    assert after.json()["has_applied"] is True
    assert after.json()["application_count"] == 1


def test_employer_sees_applicants_and_can_change_status(
    client: TestClient, employer: dict, seeker: dict
) -> None:
    job = create_job(client, employer["token"])
    application = client.post(
        "/api/applications",
        json={"job_id": job["id"]},
        headers=auth_header(seeker["token"]),
    ).json()

    received = client.get(
        "/api/applications/received",
        params={"job_id": job["id"]},
        headers=auth_header(employer["token"]),
    )
    assert received.status_code == 200
    item = received.json()["items"][0]
    assert item["applicant"]["full_name"] == "Sam Seeker"

    updated = client.patch(
        f"/api/applications/{application['id']}/status",
        json={"status": "shortlisted"},
        headers=auth_header(employer["token"]),
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "shortlisted"


def test_another_employer_cannot_touch_the_application(
    client: TestClient, employer: dict, seeker: dict, admin: dict
) -> None:
    job = create_job(client, employer["token"])
    application = client.post(
        "/api/applications",
        json={"job_id": job["id"]},
        headers=auth_header(seeker["token"]),
    ).json()

    other = register(
        client, username="other", email="other@co.test", role="employer"
    )["access_token"]
    company = client.post(
        "/api/employers/me",
        json={"company_name": "Other Co"},
        headers=auth_header(other),
    ).json()
    client.patch(
        f"/api/admin/employers/{company['id']}/verification",
        params={"verified": True},
        headers=auth_header(admin["token"]),
    )

    response = client.patch(
        f"/api/applications/{application['id']}/status",
        json={"status": "hired"},
        headers=auth_header(other),
    )
    assert response.status_code == 404

    listing = client.get("/api/applications/received", headers=auth_header(other))
    assert listing.json()["total"] == 0


def test_seeker_can_withdraw(client: TestClient, employer: dict, seeker: dict) -> None:
    job = create_job(client, employer["token"])
    application = client.post(
        "/api/applications",
        json={"job_id": job["id"]},
        headers=auth_header(seeker["token"]),
    ).json()

    response = client.delete(
        f"/api/applications/{application['id']}", headers=auth_header(seeker["token"])
    )
    assert response.status_code == 200
    assert (
        client.get("/api/applications/me", headers=auth_header(seeker["token"])).json()[
            "total"
        ]
        == 0
    )
