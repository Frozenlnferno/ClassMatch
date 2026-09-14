# ClassMatch CI/CD and deployment

ClassMatch uses one GitHub Actions workflow at `.github/workflows/ci-cd.yml`.

Pull requests and pushes to `main` run:

- Frontend lint and production build
- Flask unit tests

After all checks pass on `main`, the workflow publishes these Docker Hub images:

- `${DOCKERHUB_USERNAME}/classmatch-backend:latest`
- `${DOCKERHUB_USERNAME}/classmatch-backend:<commit-sha>`
- `${DOCKERHUB_USERNAME}/classmatch-frontend:latest`
- `${DOCKERHUB_USERNAME}/classmatch-frontend:<commit-sha>`

Production deployments use the immutable commit-SHA tags. The backend API and worker use the same backend image and release version.

## GitHub configuration

Create these repository variables under **Settings → Secrets and variables → Actions → Variables**:

- `DOCKERHUB_USERNAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_FRONTEND_ORIGIN` (optional)

Create this repository secret under **Actions → Secrets**:

- `DOCKERHUB_TOKEN`

Until the required repository variables are configured, the test jobs still run but the image-publishing job is skipped.

## Production configuration

On the deployment host, copy `.env.example` to `.env` beside `docker-compose.prod.yml`. Set:

```dotenv
DOCKERHUB_USERNAME=your-dockerhub-username
RELEASE_VERSION=the-full-commit-sha-to-deploy
```

Keep the Flask runtime secrets in `backend/.env`. Neither `.env` file should be committed.

Deploy the selected release with:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml ps
```

Compose waits for Redis and Flask health checks before starting their dependents. Confirm that every service reports healthy before considering the deployment complete.

## Rollback

Set `RELEASE_VERSION` to the previous successful commit SHA and rerun the deployment commands. Because both application images are tagged with the same commit SHA, the frontend, API, and worker roll back as one release.

## Webhook automation

A deployment webhook can run the same deployment sequence after the GitHub Actions publish job succeeds. The receiver should verify an HMAC signature, validate the commit SHA, reject duplicate or stale deliveries, serialize deployments, and run a fixed deployment script rather than payload-provided shell commands.
