# ClassMatch Design Document

**Status:** Current implementation with an in-progress Spring Boot migration  
**Last reviewed:** September 13, 2026

## 1. Purpose

ClassMatch helps students import their course schedules, organize themselves into groups, and discover group members who are currently or were previously in the same classes.

This document describes the system that exists in the repository today. The Python/Flask backend is the authoritative production API. The Java/Spring Boot backend is an incomplete migration and is not currently used by the production proxy.

## 2. System Context

```text
Browser
  |
  |-- auth --------------------------> Supabase Auth
  |
  `-- app pages and /api requests ---> Frontend Nginx
                                        |
                                        `-- /api/* ---> Flask API
                                                        |-- PostgreSQL
                                                        |-- Redis
                                                        |-- Supabase Storage/Auth Admin
                                                        `-- UIUC Course Explorer

Redis queue ---> Python schedule worker ---> PostgreSQL / Supabase Storage / UIUC API

Spring Boot API ---> PostgreSQL / Supabase JWT verification
  (development and migration only; not in the production request path)
```

The browser talks directly to Supabase for sign-up, login, logout, OAuth, password updates, and password-reset email. For application data, it sends its Supabase access token to the backend as `Authorization: Bearer <token>`.

In production, the React application and API share one public origin. Nginx serves the static frontend and proxies `/api/*` to the Flask container.

## 3. Components and Services

| Component | Technology | Responsibility |
|---|---|---|
| Web client | React 19, React Router, Vite, Tailwind CSS | Pages, session-aware routing, forms, API calls, job polling, and user notifications |
| Frontend server | Nginx | Serves the built single-page application, routes unknown paths to `index.html`, caches assets, and proxies `/api/*` |
| Production API | Python 3.13, Flask 3, Gunicorn | Users, groups, schedules, authorization, matching queries, uploads, and job creation |
| Schedule worker | Python using the same backend image | Claims and executes asynchronous ICS and manual-course import jobs |
| Job queue | Redis 7 | Queued/processing job state, leases, retries, supersession, and short-lived results |
| Primary database | PostgreSQL hosted through Supabase | Users, groups, memberships, schedules, classes, and sections |
| Authentication | Supabase Auth | Email/password auth, Google OAuth, sessions, password recovery, JWT issuance, and auth-user lifecycle |
| Object storage | Supabase Storage | Public profile/group images and temporary private ICS uploads |
| Course catalog | UIUC Course Explorer XML API | Resolves subject, course number, and CRN into authoritative section metadata |
| Migration API | Java 21, Spring Boot 4 | Partial replacement backend; currently only part of the users domain |
| CI/CD | GitHub Actions, Docker Hub | Tests and builds the separate frontend/backend repositories and publishes images |
| Home-server updater | Watchtower, per `DEPLOYMENT.md` | Pulls changed `latest` images; this service is documented but not declared in the checked-in production Compose file |

## 4. Frontend Routes and General User Flow

### 4.1 Browser routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Product landing page |
| `/signup` | Signed-out users | Create an account through Supabase Auth |
| `/login` | Signed-out users | Email/password or Google login |
| `/reset-password` | Signed-out/recovery flow | Request or complete password recovery |
| `/invite/:inviteCode` | Public entry point | Show an invitation; preserve the route through login and join after authentication |
| `/mygroups` | Authenticated | List, create, and join groups |
| `/groups/:groupId` | Authenticated group members | Group details, members, roles, settings, and schedule comparisons |
| `/schedule` | Authenticated | List schedules, import an ICS file, add courses manually, and remove schedules/courses |
| `/settings` | Authenticated | Edit profile, upload/remove avatar, update password, log out, or delete account |

`ProtectedRoute` redirects unauthenticated users to `/login?next=<original-route>`. `PublicRoute` redirects authenticated users away from login and signup, normally to `/mygroups` or the safe `next` destination.

### 4.2 Account creation and login

1. The user signs up with email, password, and name, or starts Google OAuth.
2. Supabase Auth creates the auth identity.
3. The PostgreSQL `on_auth_user_created` trigger calls `public.handle_new_user()` and creates the matching `public.users` profile.
4. The frontend stores session state through the Supabase client and listens for auth-state changes.
5. For every application API call, the frontend obtains the current access token and sends it as a bearer token.
6. Flask resolves the JWT signing key from Supabase JWKS and verifies the ES256 signature, issuer, audience, expiration, issued-at time, and subject.

### 4.3 Group flow

1. An authenticated user opens `/mygroups` and loads all groups in which they have a membership.
2. They can create a group and automatically become its `owner`, or join an existing joinable group using its code.
3. Invite links use `/invite/:inviteCode`. Signed-out users return to that URL after authentication; existing members are redirected directly to the group.
4. A group member can view group details and the member list.
5. Owners and admins can edit group information, upload/remove the icon, kick eligible members, and change eligible members between `member` and `admin`.
6. An admin cannot manage another admin; an owner can manage admins. The owner role cannot be assigned through the role endpoint.
7. If an owner leaves, ownership passes to the earliest admin, then the earliest member. If nobody remains, the group is deleted.

### 4.4 Schedule import flow

The schedule import API is asynchronous because resolving a schedule can require multiple external UIUC API calls.

```text
User selects ICS file or manual courses
  -> Flask validates the request
  -> Flask stores the ICS temporarily when applicable
  -> Flask enqueues a Redis job
  -> API returns HTTP 202 and job_id
  -> Frontend polls GET /api/schedules/jobs/{job_id} every 1.5 seconds
  -> Worker claims the job with a lease
  -> Worker parses ICS and/or resolves each course through the UIUC API
  -> Worker writes classes, sections, schedules, and associations in PostgreSQL
  -> Worker marks the job completed, failed, canceled, or superseded
  -> Frontend refreshes the displayed schedule after completion
```

An ICS import replaces the selected schedule's existing sections. A manual course import adds sections without clearing the existing schedule. Invalid individual UIUC courses are reported as skipped; if every course is skipped, the job fails without persisting courses.

### 4.5 Schedule comparison flow

1. The user selects one of their schedules from a group page.
2. The backend first verifies that the requester belongs to the group.
3. **Matching classmates** finds other group members attached to the exact same section IDs in the selected term.
4. **Past classmates** starts with the user's classes in the selected term, then finds the most recent earlier section of the same class taken by each other group member.
5. The frontend groups and displays these matches alongside member profile information.

### 4.6 Profile and account deletion flow

1. The settings page loads the authenticated user's private profile.
2. Profile fields are updated through Flask; passwords are updated directly through Supabase Auth.
3. Avatar uploads go through Flask into the public `images` storage bucket. Replaced images are deleted on a best-effort basis.
4. During account deletion, each owned group is reassigned to an admin/member or deleted if empty.
5. Flask deletes the Supabase Auth user. Database foreign keys then cascade deletion of the public user, memberships, and schedules.

## 5. HTTP API

Unless stated otherwise, every `/api/*` endpoint requires a valid Supabase bearer token. JSON error responses generally use `{ "error": "message" }`.

### 5.1 System

| Method | Path | Input | Success | Purpose |
|---|---|---|---|---|
| `GET` | `/` | None | `200 {message, status}` | Basic Flask process check; it does not verify dependencies |

### 5.2 Users

Base path: `/api/users`

| Method | Path | Input | Success | Purpose |
|---|---|---|---|---|
| `GET` | `/me` | Bearer token | `200` private profile | Return `id`, `email`, `name`, `created_at`, `bio`, and `avatar_url` |
| `PATCH` | `/me` | JSON subset of `name`, `bio`, `avatar_url` | `200` status | Update supplied profile fields; `avatar_url: null` removes the avatar |
| `POST` | `/me/avatar` | Multipart image in `image` or `avatar` | `200 {avatar_url}` | Validate and upload GIF/JPEG/PNG/WEBP avatar |
| `DELETE` | `/me` | Bearer token | `200` status | Reassign/delete owned groups and delete the account |
| `GET` | `/:userId` | Path UUID | `200` public profile | Return public profile fields without email |

### 5.3 Groups

Base path: `/api/groups`

| Method | Path | Input | Success | Purpose |
|---|---|---|---|---|
| `GET` | `/` | Bearer token | `200` group array | List memberships with role, join code, member count, joinability, and icon |
| `POST` | `/create` | `{groupName, description?, joinable?, group_icon_url?}` | `201` status | Create a group and make the caller owner |
| `POST` | `/join` | `{join_code}` | `200 {status, group_id, already_member}` | Join using a code |
| `GET` | `/join` | None | `405` | Explicitly rejects the former GET-based join operation |
| `POST` | `/leave` | `{group_id}` | `200` status | Leave and, when needed, transfer ownership or delete the group |
| `GET` | `/:groupId` | Path ID | `200` group details | Return details only when the caller is a member |
| `PATCH` | `/:groupId` | Subset of `{name, description, joinable, group_icon_url}` | `200` status | Update group settings as an admin/owner |
| `GET` | `/:groupId/members` | Path ID | `200` member array | List member ID, name, role, joined time, and avatar |
| `POST` | `/:groupId/kick` | `{member_id}` | `200` status | Remove an eligible member as an admin/owner |
| `POST` | `/:groupId/change-role` | `{member_id, new_role}` | `200` status | Set an eligible member to `member` or `admin` |
| `POST` | `/join/:joinCode` | Path code | `200 {status, group_id, already_member}` | Join from an invite URL |
| `POST` | `/:groupId/icon` | Multipart image in `image` or `icon` | `200 {group_icon_url}` | Upload and assign a group icon as an admin/owner |

### 5.4 Schedules

Base path: `/api/schedules`

The `term` query value must be `spring`, `summer`, or `fall`; `year` must be between 2000 and 2100.

| Method | Path | Input | Success | Purpose |
|---|---|---|---|---|
| `GET` | `/?term=&year=` | Term/year query | `200` course array | Return the caller's sections for one schedule |
| `GET` | `/list` | Bearer token | `200` schedule summaries | Return `{term, year, class_count}` for every schedule |
| `POST` | `/` | Multipart `.ics` in `ics` | `202` job | Store the ICS and queue a replacement import |
| `POST` | `/courses?term=&year=` | `{courses: [{subject, course, crn}]}` | `202` job | Queue manual course resolution and addition |
| `GET` | `/jobs/:jobId` | Path UUID | `200` job or `404` | Return status only when the job belongs to the caller |
| `DELETE` | `/?term=&year=` | Term/year query | `200` message | Delete one complete schedule |
| `DELETE` | `/courses?term=&year=` | `{crns: [string]}` | `200` message | Remove selected sections from a schedule |
| `GET` | `/matching-classmates?group_id=&term=&year=` | Group and schedule query | `200` matches | Find group members in identical sections |
| `GET` | `/past-classmates?group_id=&term=&year=` | Group and schedule query | `200` matches | Find group members who took the same classes earlier |

A job response contains:

```json
{
  "job_id": "uuid",
  "job_type": "ics_schedule_import | crn_schedule_import",
  "status": "queued | processing | completed | failed | canceled",
  "attempts": 0,
  "max_attempts": 3,
  "year": 2026,
  "term": "fall",
  "last_error": "present on failure",
  "result": "present after successful processing"
}
```

Successful import results contain the resolved courses, saved/skipped counts, and details for skipped courses.

### 5.5 Partial Spring Boot API

The Spring service is development-only today. Nginx contains a commented migration route, and `docker-compose.prod.yml` does not run the Java container.

| Method | Path | State | Purpose |
|---|---|---|---|
| `GET` | `/api/users/me` | Implemented | Return current user through Spring JDBC |
| `PATCH` | `/api/users/me` | Implemented, contract still evolving | Update current user with Jakarta validation |
| `GET` | `/api/test/authenticated` | Development/testing | Confirm Spring JWT authentication |
| `GET` | `/actuator/health` | Implemented and public | Spring health endpoint |
| `GET` | `/actuator/info` | Implemented and public | Spring application information |

Spring Security is stateless, validates Supabase OAuth2 JWTs, allows CORS preflight, exposes only the two actuator endpoints publicly, and denies unspecified routes by default.

## 6. Data Model

| Table | Key fields | Relationships and purpose |
|---|---|---|
| `users` | `id` UUID, email, name, bio, avatar URL | `id` references `auth.users`; created by an auth trigger |
| `groups` | bigint ID, name, description, join code, joinable, created-by | Creator references `users`; join code is unique |
| `group_members` | group ID, user ID, role, joined-at | Composite primary key; roles are `owner`, `admin`, or `member` |
| `classes` | bigint ID, subject, number, title | One logical course; subject/number is unique |
| `sections` | bigint ID, year, term, class ID, section, CRN, meeting data | One offering of a class; year/term/CRN is unique |
| `schedules` | bigint ID, user ID, year, term | One schedule per user/term/year |
| `schedule_sections` | schedule ID, section ID | Many-to-many link between schedules and sections |

Important cascade behavior:

- Deleting an auth user deletes the matching public user.
- Deleting a public user deletes their memberships and schedules.
- Deleting a group deletes its memberships.
- Deleting a schedule deletes its `schedule_sections` links.
- Shared class and section catalog rows remain unless explicitly deleted through their own relationships.

The Supabase migration enables row-level security and grants browser clients limited self/member reads. The Flask and Spring backends use their configured PostgreSQL credentials and enforce application authorization in backend code.

## 7. Redis Job Design

Redis currently stores four kinds of queue data:

- `schedule_jobs:ready`: sorted set of jobs eligible to run.
- `schedule_jobs:processing`: sorted set ordered by lease expiration.
- `schedule_job:<jobId>`: hash containing metadata, state, payload, result, attempts, and lease information.
- `schedule_jobs:latest:<user>:<year>:<term>:<type>`: pointer used to supersede an older equivalent job.

Queue transitions are implemented as Lua scripts so enqueue, claim, heartbeat, completion, retry, and expired-lease recovery are atomic.

The worker:

1. Requeues expired processing jobs.
2. Claims the next ready job and obtains a lease token.
3. Sends heartbeats while processing.
4. Executes either an ICS or CRN import.
5. Completes the job only if its lease is still valid and it has not been superseded.
6. Retries failures with increasing delay until `max_attempts` is reached.
7. Deletes temporary ICS objects after terminal processing.

Job records and results expire after the configured TTL, currently defaulting to 24 hours.

## 8. External Integrations

### Supabase Auth

- Called directly by the browser for normal auth operations.
- Issues the JWT used by the application API.
- Called with admin credentials by Flask only for account deletion.
- Google is the configured OAuth provider used by the frontend.

### Supabase Storage

- Public `images` bucket: avatars and group icons.
- Private `schedule-ics` bucket: temporary ICS job payloads.
- Flask validates upload size and declared MIME type/filename extension before upload.

### UIUC Course Explorer

The worker requests:

```text
https://courses.illinois.edu/cisapp/explorer/schedule/{year}/{term}/{subject}/{course}/{crn}.xml
```

It parses the XML into class title, subject/number, section, CRN, course type, instructor, room, meeting times, and meeting days. Returned subject, course number, and CRN must match the request.

## 9. Deployment and Networking

### Development Compose

| Service | Host port | Notes |
|---|---:|---|
| `frontend` | 3000 | Production-built frontend served by Nginx |
| `backend` | 5000 | Flask development server with source bind-mounted |
| `backend-java` | 8080 | Spring migration service; its `SERVER_PORT` must match the Compose mapping |
| `redis` | 6379 | Local Redis |
| `worker` | None | Python worker using the backend source mount |

The PostgreSQL database and Supabase services are external to this Compose project.

### Production Compose

- Pulls `classmatch-frontend:latest` and `classmatch-backend:latest` from Docker Hub.
- Runs Nginx publicly on port 3000.
- Exposes Flask only to the internal Compose network on port 5000.
- Runs a separate worker container from the same backend image.
- Runs Redis internally.
- Does not currently run Spring Boot.

### CI/CD

The frontend and Python backend currently remain separate Git repositories with separate workflows.

- Frontend CI installs dependencies, lints, builds, then publishes `latest` and commit-SHA images.
- Backend CI installs dependencies, runs the unittest suite, then publishes `latest` and commit-SHA images.
- Docker Hub credentials are held in GitHub secrets; public build configuration is held in repository variables.

## 10. Configuration Boundaries

Secrets belong in uncommitted `.env` files or deployment secret stores. Committed `.env.example` files should contain only placeholders.

Key frontend build variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_FRONTEND_ORIGIN`
- Optional `VITE_API_BASE_URL`

Key Flask variables:

- `FRONTEND_ORIGIN`
- `DATABASE_URL`, `DB_SSLMODE`
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, JWT issuer/audience
- `REDIS_URL` and job lease/retry/TTL settings
- UIUC timeout and upload/request limits
- Storage bucket and prefix settings

Key Spring variables:

- `SPRING_DATASOURCE_URL`, username, and password
- Supabase JWT issuer, JWKS URL, and audience
- `FRONTEND_ORIGIN`
- `SERVER_PORT`

## 11. Current Boundaries and Known Transition Points

- Flask owns all production `/api/*` traffic.
- The Spring implementation is not yet API-compatible for the entire users domain and should not receive production traffic until its request/response contract matches the frontend.
- Schedules and their worker should remain together during any incremental migration.
- Nginx is already prepared for path-based migration by enabling a more-specific `/api/users` proxy before the general `/api/` rule.
- Redis is used only for schedule jobs. It can later be retained, replaced by a PostgreSQL job table, or replaced by a maintained job framework without changing the frontend's `202 + job_id + polling` contract.
- `DEPLOYMENT.md` assumes an external Watchtower installation; the checked-in production Compose file alone does not create it.

## 12. Source Map

| Concern | Primary location |
|---|---|
| Frontend routes | `frontend/src/App.jsx` |
| Frontend API clients | `frontend/src/features/*/*Service.js` and `frontend/src/features/auth/auth.js` |
| Nginx routing | `frontend/nginx.conf` |
| Flask application setup | `backend/app/__init__.py` |
| Authentication middleware | `backend/app/utils/auth.py` |
| User domain | `backend/app/routes/users/` |
| Group domain | `backend/app/routes/groups/` |
| Schedule domain | `backend/app/routes/schedules/` |
| Queue and worker | `backend/app/jobs/`, `backend/run_worker.py` |
| Database helpers | `backend/app/utils/db.py` |
| Supabase admin/storage client | `backend/app/utils/supabase_admin.py` |
| Spring migration | `backend-java/src/main/` |
| Database schema | `supabase/migrations/` |
| Local orchestration | `docker-compose.yml` |
| Production orchestration | `docker-compose.prod.yml` |
| Deployment notes | `DEPLOYMENT.md` |
