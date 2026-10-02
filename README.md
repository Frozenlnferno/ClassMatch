# ClassMatch

ClassMatch is a course-schedule and group-matching application. This monorepo contains a React frontend, the production Flask API and worker, an in-progress Spring Boot backend migration, Supabase migrations, and Docker Compose configuration.

## Repository layout

- `frontend/`: React, Vite, and Nginx
- `backend/`: Flask API and schedule worker
- `backend-java/`: in-progress Spring Boot migration
- `supabase/`: local Supabase configuration and database migrations
- `docker-compose.yml`: local development stack
- `docker-compose.prod.yml`: production stack using published images

## Local setup

Docker Compose is the supported local runtime.

1. Install the Supabase CLI and run `supabase start` from the repository root. It starts the local API at `http://127.0.0.1:54321` and PostgreSQL at port `54322`. To rebuild an existing local database with every migration, run `supabase db reset`; it affects only the local Supabase instance.
2. Copy `.env.example` to `.env`, then set `VITE_SUPABASE_PUBLISHABLE_KEY` from `supabase status -o env`.
3. Copy `backend/.env.example` to `backend/.env`, then set `SUPABASE_SECRET_KEY` from the same command.
4. Start the application stack:

   ```bash
   docker compose up --build
   ```

The frontend is available at `http://localhost:3000` and Flask at `http://localhost:5000`. Dockerized backend services use `host.docker.internal` to reach local Supabase; production Compose uses the separate untracked `backend/.env.production` file.

### Local Google OAuth

Copy `supabase/.env.example` to `supabase/.env` and set credentials from a Google OAuth client dedicated to local development. In Google Cloud, add `http://127.0.0.1:54321/auth/v1/callback` as an authorized redirect URI. Restart local Supabase with `supabase stop` followed by `supabase start`. These credentials and settings are used only by local Supabase; hosted production OAuth remains configured in the Supabase dashboard.

The Spring migration is optional and does not currently compile. After completing its in-progress user-update implementation, copy `backend-java/.env.example` to `backend-java/.env` and include it with:

```bash
docker compose --profile migration up --build
```

## Continuous integration

Pull requests and pushes to `main` run frontend lint/build checks and Flask tests. Successful `main` builds publish frontend and backend images tagged with both `latest` and the full commit SHA. The incomplete Spring migration is isolated behind a Compose profile until it compiles again.

See `DEPLOYMENT.md` for production setup and `DESIGN.md` for the current architecture.
