"""Job listing, search and employer ownership rules."""

from fastapi.testclient import TestClient

from tests.conftest import auth_header, create_job, register


def test_job_list_is_public(client: TestClient) -> None:
    response = client.get("/api/jobs")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_employer_can_create_and_list_own_job(client: TestClient, employer: dict) -> None:
    job = create_job(client, employer["token"], title="Staff Engineer")
    assert job["title"] == "Staff Engineer"
    assert job["employer"]["company_name"] == "Acme Corp"
    assert job["status"] == "open"

    mine = client.get("/api/employers/me/jobs", headers=auth_header(employer["token"]))
    assert mine.status_code == 200
    assert [item["title"] for item in mine.json()["items"]] == ["Staff Engineer"]


def test_unverified_employer_cannot_post(client: TestClient) -> None:
    token = register(
        client, username="newco", email="new@co.test", role="employer"
    )["access_token"]
    client.post(
        "/api/employers/me",
        json={"company_name": "New Co"},
        headers=auth_header(token),
    )
    response = client.post(
        "/api/jobs",
        json={"title": "Engineer", "description": "A long enough description here."},
        headers=auth_header(token),
    )
    assert response.status_code == 403


def test_job_seeker_cannot_post_a_job(client: TestClient, seeker: dict) -> None:
    response = client.post(
        "/api/jobs",
        json={"title": "Engineer", "description": "A long enough description here."},
        headers=auth_header(seeker["token"]),
    )
    assert response.status_code == 403


def test_anonymous_cannot_post_a_job(client: TestClient) -> None:
    response = client.post(
        "/api/jobs",
        json={"title": "Engineer", "description": "A long enough description here."},
    )
    assert response.status_code == 401


def test_search_matches_title_and_company(client: TestClient, employer: dict) -> None:
    create_job(client, employer["token"], title="Rust Engineer")
    create_job(client, employer["token"], title="Technical Writer")

    assert client.get("/api/jobs", params={"q": "rust"}).json()["total"] == 1
    assert client.get("/api/jobs", params={"q": "Acme"}).json()["total"] == 2
    assert client.get("/api/jobs", params={"q": "nothing here"}).json()["total"] == 0


def test_filters_and_pagination(client: TestClient, employer: dict) -> None:
    create_job(client, employer["token"], title="One", employment_type="contract")
    create_job(client, employer["token"], title="Two", location="Berlin")
    create_job(client, employer["token"], title="Three", salary_max=200000)

    assert client.get("/api/jobs", params={"employment_type": "contract"}).json()["total"] == 1
    assert client.get("/api/jobs", params={"location": "berlin"}).json()["total"] == 1
    assert client.get("/api/jobs", params={"salary_min": 150000}).json()["total"] == 1

    page = client.get("/api/jobs", params={"page": 1, "page_size": 2}).json()
    assert len(page["items"]) == 2
    assert page["total"] == 3
    assert page["pages"] == 2


def test_salary_range_is_validated(client: TestClient, employer: dict) -> None:
    response = client.post(
        "/api/jobs",
        json={
            "title": "Backwards",
            "description": "A long enough description here.",
            "salary_min": 100000,
            "salary_max": 50000,
        },
        headers=auth_header(employer["token"]),
    )
    assert response.status_code == 422


def test_employer_cannot_edit_another_employers_job(
    client: TestClient, employer: dict, admin: dict
) -> None:
    job = create_job(client, employer["token"])

    other = register(
        client, username="rival", email="rival@co.test", role="employer"
    )["access_token"]
    company = client.post(
        "/api/employers/me",
        json={"company_name": "Rival Inc"},
        headers=auth_header(other),
    ).json()
    client.patch(
        f"/api/admin/employers/{company['id']}/verification",
        params={"verified": True},
        headers=auth_header(admin["token"]),
    )

    response = client.patch(
        f"/api/jobs/{job['id']}",
        json={"title": "Hijacked"},
        headers=auth_header(other),
    )
    assert response.status_code == 404


def test_closed_jobs_are_hidden_from_the_default_listing(
    client: TestClient, employer: dict
) -> None:
    job = create_job(client, employer["token"])
    client.patch(
        f"/api/jobs/{job['id']}",
        json={"status": "closed"},
        headers=auth_header(employer["token"]),
    )
    assert client.get("/api/jobs").json()["total"] == 0
    assert client.get("/api/jobs", params={"job_status": "closed"}).json()["total"] == 1


def test_delete_job(client: TestClient, employer: dict) -> None:
    job = create_job(client, employer["token"])
    response = client.delete(
        f"/api/jobs/{job['id']}", headers=auth_header(employer["token"])
    )
    assert response.status_code == 200
    assert client.get(f"/api/jobs/{job['id']}").status_code == 404
