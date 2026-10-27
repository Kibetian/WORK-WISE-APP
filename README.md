# WorkWise

A job board. Job seekers build a profile, upload documents and apply for roles;
employers publish jobs and move applicants through a hiring pipeline;
administrators verify accounts and review uploaded documents.

This is a rebuild of an earlier Flask/JSX prototype. The stack is now FastAPI
with SQLModel on the server and React with TypeScript on the client. What
changed and why is in [`NOTES.md`](NOTES.md).

```
workwise/
├── server/          FastAPI application, tests, seed script
│   ├── app/
│   │   ├── api/routes/   auth, jobs, applications, jobseekers, employers, files, admin
│   │   ├── core/         settings and security primitives
│   │   ├── services/     storage, pagination, response builders
│   │   ├── models.py     SQLModel tables
│   │   ├── schemas.py    request/response models
│   │   ├── deps.py       auth and role dependencies
│   │   └── main.py       application factory
│   ├── tests/       pytest suite
│   └── seed.py      demo data
├── client/          React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/   layout, route guard, shared UI
│       ├── context/      authentication state
│       ├── lib/          typed API client, formatting, hooks
│       └── pages/        public, jobseeker/, employer/, admin/
└── docker-compose.yml
```

## Running it

**[SETUP.md](SETUP.md) is the full walkthrough** — what to install, the exact
commands for Windows and for macOS/Linux, and what to do when something fails.
The short version follows.

Extract this somewhere empty, not over a previous copy. On Windows,
`workwise-app` and `WorkWise`, and `src/components` and `src/Components`, are
the same name, so unzipping over an older version merges the two codebases and
the old files win.

### Without Docker

Two terminals. The server, from `server/`:

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp .env.example .env                                # Windows: Copy-Item .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

The client, from `client/`:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` and `/uploads` to port 8000,
so no CORS configuration is needed in development. The API's interactive
documentation is at <http://localhost:8000/docs>.

### With Docker

```bash
docker compose up --build
docker compose exec api python seed.py     # demo accounts and sample jobs
```

The app is then at <http://localhost:8080> and the API at
<http://localhost:8000>.

## Demo accounts

Available after running `python seed.py`:

| Email | Password | Role |
| --- | --- | --- |
| `admin@workwise.dev` | `admin1234` | Administrator |
| `hiring@northwind.dev` | `employer1234` | Employer (verified — can post jobs) |
| `talent@lumenlabs.dev` | `employer1234` | Employer (unverified — cannot post yet) |
| `ada@example.com` | `seeker1234` | Job seeker (verified) |
| `grace@example.com` | `seeker1234` | Job seeker |

`python seed.py --reset` drops every table and rebuilds from scratch.

## Tests

```bash
cd server
pytest
```

The suite runs against an in-memory SQLite database with a fresh schema per
test, and covers the ORM mapping, registration and login, role boundaries, job
ownership, duplicate applications, uploads and the admin surface.

## How permissions work

Three roles, checked on the server through FastAPI dependencies rather than in
the UI:

- **Job seeker** — one profile, uploads documents, applies to open jobs once
  each, withdraws their own applications.
- **Employer** — one company profile. An administrator must verify the company
  before jobs can be published. Employers see only their own jobs and the
  applications to them.
- **Administrator** — verifies employers and job seekers, reviews uploaded
  documents, deactivates accounts, reads platform statistics. Admin accounts
  cannot be created through registration; insert one directly or use the seed
  script.

## API surface

Everything lives under `/api`. Full, interactive documentation is at `/docs`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/token`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout` |
| Jobs | `GET /jobs`, `GET /jobs/{id}`, `POST /jobs`, `PATCH /jobs/{id}`, `DELETE /jobs/{id}` |
| Applications | `POST /applications`, `GET /applications/me`, `DELETE /applications/{id}`, `GET /applications/received`, `PATCH /applications/{id}/status` |
| Job seekers | `POST/GET/PATCH /jobseekers/me`, `GET /jobseekers/me/documents`, `GET /jobseekers`, `GET /jobseekers/{id}`, `GET /jobseekers/{id}/documents` |
| Employers | `POST/GET/PATCH /employers/me`, `GET /employers/me/jobs`, `GET /employers`, `GET /employers/{id}` |
| Files | `POST /files/profile-image`, `POST /files/company-logo`, `POST /files/documents`, `DELETE /files/documents/{id}` |
| Admin | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/{id}/active`, `GET /admin/employers`, `PATCH /admin/employers/{id}/verification`, `GET /admin/jobseekers`, `PATCH /admin/jobseekers/{id}/verification`, `GET /admin/documents`, `PATCH /admin/documents/{id}/review` |

`GET /jobs` supports `q`, `location`, `employment_type`, `salary_min`,
`employer_id`, `job_status`, `sort` and page/page_size. List endpoints all
return `{items, total, page, page_size, pages}`.

## Configuration

Server settings come from the environment (see `server/.env.example`). The ones
that matter:

- `SECRET_KEY` — signs JWTs. **Set this.** With the built-in default, tokens are
  not secure; without a stable value across restarts, everyone is signed out on
  each deploy.
- `DATABASE_URL` — SQLite by default, e.g.
  `postgresql+psycopg://user:pass@host:5432/workwise` for Postgres.
- `CORS_ORIGINS` — comma-separated browser origins allowed to call the API.
- `MAX_UPLOAD_MB` — per-file upload limit, 10MB by default.
- `UPLOAD_DIR` — where uploaded files are written.

## Uploads

Files are written to `UPLOAD_DIR` and served back by the API under `/uploads`.
No third-party account is required. Under Docker they live in a named volume so
they survive a rebuild. For a real deployment, put them on durable storage or
swap `app/services/storage.py` for an object-store implementation — it is the
only module that touches the filesystem.

## Production notes

Before running this anywhere public: set a real `SECRET_KEY`, move to Postgres,
put the API behind HTTPS, narrow `CORS_ORIGINS` to your actual front-end
origin, and introduce Alembic migrations — the app currently calls
`create_all()` at startup, which creates missing tables but will not alter
existing ones.
