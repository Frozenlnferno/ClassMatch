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

1. Copy `.env.example` to `.env` and set the public frontend values.
2. Copy `backend/.env.example` to `backend/.env` and set the backend credentials.
3. Start the production application stack:

   ```bash
   docker compose up --build
   ```

The frontend is available at `http://localhost:3000` and Flask at `http://localhost:5000`.

The Spring migration is optional and does not currently compile. After completing its in-progress user-update implementation, copy `backend-java/.env.example` to `backend-java/.env` and include it with:

```bash
docker compose --profile migration up --build
```

## Continuous integration

Pull requests and pushes to `main` run frontend lint/build checks and Flask tests. Successful `main` builds publish frontend and backend images tagged with both `latest` and the full commit SHA. The incomplete Spring migration is isolated behind a Compose profile until it compiles again.

See `DEPLOYMENT.md` for production setup and `DESIGN.md` for the current architecture.
