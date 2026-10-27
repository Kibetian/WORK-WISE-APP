# What changed, and why

Notes on the rebuild, for anyone comparing this against the original
`WorkWise/` prototype.

## Why it did not run

The original could not start in either half.

On the client, `src/main.jsx` mounted `./Components/App.jsx`, while the
top-level `src/App.jsx` imported a `CreateProfile` component that did not exist
anywhere in the tree. The whole `src/Components/` directory was duplicated as
`src/Components/Components/`, with the two copies diverging — the inner
`App.jsx` imported `../store/AuthContext`, a directory that was never created,
so that copy could not compile at all. Three different API hosts appeared across
components: `http://127.0.0.1:5000`, `http://localhost:5555`, and a `proxy`
field in `package.json` (a Create React App setting that Vite ignores). There
was no requirements file for the server at all.

## Security problems carried over from the original

These were the ones worth naming, because each one had a concrete consequence.

**The JWT secret was regenerated on every boot.** `secrets.token_hex(32)` ran at
import time, so every restart silently invalidated every issued token and signed
every user out. It is now a configured value with a documented default that must
be changed.

**Live Cloudinary credentials sat in `server/utils.py`** — cloud name, API key
and API secret, in source, in the archive. Uploads now go to local disk through
`app/services/storage.py`, so no third-party account is involved. **If that
Cloudinary account is still active, rotate those credentials.**

**Login never returned the user's role**, yet `Login.jsx` read `data.userType`
and branched on it. The value was always undefined, so every login stored
nothing and redirected to `/jobseeker` or `/employer` — neither of which was a
registered route. Login now returns the user record, and `/auth/me` returns the
matching profile alongside it.

**Several endpoints had no authorization at all.** `UpdateJob` carried no
`@jwt_required()` and no ownership check, so anyone who could reach the server
could rewrite any job posting, including the salary and the employer id.
`UploadFiles` and `Upload` took a `jobseeker_id` from the URL and never checked
it against the caller, so any authenticated user could attach files to anyone's
profile or overwrite their photo. Ownership is now checked on every write, and
the resource is resolved from the token rather than the URL.

**`UpdateEmployerProfile` accepted `profile_verified` from the request body**,
letting an employer verify themselves and bypass the check that gates job
posting. Verification now lives only on the admin routes; the employer update
schema has no such field.

**Passwords were hashed with the default Werkzeug algorithm** and the seed
script stored three of them unhashed (`password=fake.password()` straight into
the column), so those accounts could never log in. Hashing is bcrypt throughout
and the seed data uses it.

## Data model

Names now say what they hold: `JobSeekerProfile` and `EmployerProfile` rather
than `JobSeeker` and `Employer` for what are profile rows attached to a `User`.
`Job.employer` was declared twice in the original model, with the second
declaration silently replacing the first.

`JobApplication` had a `status` column and an `application_date` column, and the
one place that created applications set neither, so every row was created with
both null. Status is now an enum with a default, timestamps are set on write,
and a unique constraint on `(job_id, job_seeker_id)` enforces at the database
level the "already applied" check that previously existed only in Python.

`File.approved` was a boolean populated from `request.form.get('approved')`,
which yields a string — `"false"` is truthy, so a rejected document read as
approved. It is now a three-state enum: pending, approved, rejected.

Jobs gained `location`, `employment_type` and a `status`, which is what makes
filtering and closing a role possible.

## API

Route names are consistent and resource-shaped: `/api/jobs`,
`/api/applications`, `/api/jobseekers/me`. The original mixed
`/jobseekers/profile`, `/myprofile`, `/update-profile`, `/verify/employer/<id>`
and `/unverify/employer/<id>` — two endpoints where one with a parameter does.

Every list endpoint paginates and returns `{items, total, page, page_size,
pages}`; the original returned unbounded arrays. `GET /jobs` filters and sorts
server-side, so the job board no longer downloads every row to filter it in the
browser.

Validation is declarative through Pydantic rather than `reqparse`, which means
the interactive documentation at `/docs` is generated from the same definitions
the server validates against.

## Client

One component tree, one router, one API module. `src/lib/api.ts` holds every
request, so the token, the base URL and the error shape are decided in one
place. `AuthContext` restores the session on load and clears it when the server
rejects a token; `ProtectedRoute` gates each branch of the route tree by role
and waits for the session to resolve before redirecting, so a refresh on a deep
link does not bounce you to the login page.

The original had no `Admin` route wired into the router despite `Pages/Admin.jsx`
existing, and its home page had nav buttons that were plain `<button>` elements
with no handler.

## What is deliberately not here

No Alembic migrations — the app calls `create_all()` at startup, which creates
missing tables but will not alter existing ones. That is fine while the schema
is settling and needs replacing before the first production change.

No refresh tokens. Access tokens last 24 hours and the client re-authenticates
when one expires.

No email. Verification and document review happen in the admin UI with no
notification to the candidate beyond what they see on their own pages.
