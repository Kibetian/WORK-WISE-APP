# Setting up WorkWise

Start to finish, on a machine that has nothing installed yet. Two terminals,
about ten minutes.

> **Extract this somewhere empty.** Do not unzip it into your existing
> `WorkWise` folder. Windows treats `workwise` and `WorkWise` as the same name,
> and `src/Components` and `src/components` as the same folder, so extracting
> over the old project silently merges the two codebases — old `.jsx` files end
> up beside new `.tsx` ones, and Vite loads the old ones first. That is what
> caused the `Failed to resolve import "./Components/CreateProfile"` error.
> `C:\dev\workwise-app` is a good destination. Keep it out of OneDrive:
> OneDrive syncs `node_modules` file by file, which makes `npm install` slow
> and can restore files you delete.

## 1. What you need to install

| Tool | Version | Where | What for |
| --- | --- | --- | --- |
| Python | 3.11 or newer | <https://python.org/downloads> | The API |
| Node.js | 20 LTS or newer | <https://nodejs.org> | The web client |

On the Windows Python installer, tick **"Add python.exe to PATH"** on the first
screen. It is off by default, and without it the commands below will not be
found. Node's installer adds itself to PATH on its own.

Nothing else is required. There is no database to install — the app uses
SQLite, which ships with Python — and no cloud account, because uploaded files
are written to a local folder.

Open a **new** terminal after installing (PATH changes do not reach terminals
that were already open) and check all three:

```powershell
python --version    # Python 3.11.x or newer
node --version      # v20.x or newer
npm --version       # 10.x or newer
```

If `python` opens the Microsoft Store instead of printing a version, Windows is
intercepting it. Use `py -3` in place of `python` everywhere below, or turn off
the alias under Settings → Apps → Advanced app settings → App execution aliases.

## 2. Start the API

In your first terminal:

**Windows (PowerShell)**

```powershell
cd C:\dev\workwise-app\server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux**

```bash
cd ~/workwise-app/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

If PowerShell refuses to run the activate script ("running scripts is disabled
on this system"), this clears it for that window only:

```powershell
Set-ExecutionPolicy -Scope Process RemoteSigned
```

You should see `Uvicorn running on http://127.0.0.1:8000`. Leave it running.
`python seed.py` prints the demo logins; it only needs to run once.

Check it directly at <http://localhost:8000/docs> — that is the interactive API
documentation, generated from the code, where you can call any endpoint.

## 3. Start the web client

In a **second** terminal, leaving the first one running:

```powershell
cd C:\dev\workwise-app\client
npm install
npm run dev
```

`npm install` takes a minute the first time. It will report a few
vulnerabilities in dev-only tooling — that is normal for a fresh React project
and nothing in the shipped bundle is affected. Do not run `npm audit fix
--force`; it downgrades Vite and breaks the build.

Open <http://localhost:5173>.

The client reaches the API through a relative `/api` path that Vite proxies to
port 8000, so it works whichever port Vite picks if 5173 is busy. It needs the
API from step 2 running — if the job list shows an error, that terminal is what
to check.

## 4. Sign in

| Email | Password | What you get |
| --- | --- | --- |
| `ada@example.com` | `seeker1234` | Job seeker: profile, documents, applications |
| `hiring@northwind.dev` | `employer1234` | Employer, verified: post jobs, review applicants |
| `talent@lumenlabs.dev` | `employer1234` | Employer, unverified: blocked from posting until an admin verifies |
| `admin@workwise.dev` | `admin1234` | Admin: verify accounts, review documents, statistics |

Signing in as the admin and verifying Lumen Labs, then signing in as Lumen Labs
and posting a job, walks through the part of the app most worth seeing.

## 5. Confirm it works

From `server/`, with the virtual environment active:

```powershell
pytest
```

Seventy-one tests covering the ORM mapping, registration, login, role
boundaries, job ownership, duplicate applications, uploads and the admin
routes. They run against a throwaway in-memory database and do not touch your
data.

From `client/`:

```powershell
npm run typecheck
```

## Running it with Docker instead

If you would rather not install Python and Node, and have Docker Desktop:

```powershell
cd C:\dev\workwise-app
docker compose up --build
docker compose exec api python seed.py
```

The app is then at <http://localhost:8080> and the API at
<http://localhost:8000>. This runs Postgres rather than SQLite.

## Day-to-day

Once set up, starting the app again is two terminals:

```powershell
# terminal 1
cd C:\dev\workwise-app\server
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# terminal 2
cd C:\dev\workwise-app\client
npm run dev
```

Both reload automatically when you edit a file. Stop either with `Ctrl+C`.

## When something goes wrong

**`Failed to resolve import "./Components/CreateProfile"`** — old files from the
previous version are mixed into `client/src`. Delete the folder entirely and
re-extract the zip somewhere empty. Nothing in this project imports
`CreateProfile`; if you see that name, you are running old code.

**`npm error ENOENT ... server\package.json`** — the server is Python, not
Node. `npm` commands belong in `client/` only; the server runs with `uvicorn`.

**`'python' is not recognized`** — Python is not on PATH. Reinstall with "Add
python.exe to PATH" ticked, or use `py -3`.

**`'uvicorn' is not recognized`** — the virtual environment is not active. Run
`.\.venv\Scripts\Activate.ps1` from `server/`; your prompt should start with
`(.venv)`.

**`[Errno 48] Address already in use` / port 8000 busy** — an earlier API is
still running. Close that terminal, or use `--port 8001` and set
`VITE_API_TARGET=http://localhost:8001` in `client/.env`.

**`InvalidRequestError: ... failed to locate a name`** on every API call — a
relationship annotation in `server/app/models.py` cannot be reduced to a class
name. Almost always because someone added `from __future__ import annotations`
to that file: under PEP 563 the annotations become strings, and SQLModel hands
text it cannot parse to SQLAlchemy as the target class. The comment at the top
of `models.py` explains it, and `pytest tests/test_models.py` catches it.

**Job list is empty** — the seed has not run. From `server/` with the venv
active: `python seed.py`. To rebuild the data from scratch, `python seed.py
--reset`.

**Login fails for a demo account** — the database predates the current seed.
`python seed.py --reset` recreates every table and account.

**A schema change is not showing up** — the app creates missing tables at
startup but does not alter existing ones. During development, delete
`server/workwise.db` and re-run `python seed.py`. Before the first real
deployment, add Alembic migrations.

## Where things live

```
workwise-app/
├── server/              FastAPI application
│   ├── app/
│   │   ├── api/routes/  one module per area: auth, jobs, applications,
│   │   │                jobseekers, employers, files, admin
│   │   ├── core/        settings, password hashing, JWT
│   │   ├── services/    file storage, pagination, response builders
│   │   ├── models.py    database tables
│   │   ├── schemas.py   request and response shapes
│   │   ├── deps.py      authentication and role checks
│   │   └── main.py      app assembly
│   ├── tests/           pytest suite
│   ├── seed.py          demo data
│   ├── uploads/         files people upload (created on first run)
│   └── .env             your settings (copied from .env.example)
└── client/              React + TypeScript
    └── src/
        ├── lib/api.ts   every API call the client makes
        ├── context/     signed-in user state
        ├── components/  layout, route guard, shared UI
        └── pages/       public, jobseeker/, employer/, admin/
```

`README.md` covers the API surface and configuration. `NOTES.md` explains what
was wrong with the original version and why each thing changed — worth reading
if you are comparing the two.

## Before this goes anywhere public

Set a real `SECRET_KEY` in `server/.env`, generated with:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

It signs the login tokens. Then move to Postgres, narrow `CORS_ORIGINS` to your
actual front-end address, put the API behind HTTPS, and add Alembic migrations.
