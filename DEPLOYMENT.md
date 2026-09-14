# ClassMatch CI/CD

This project currently has separate Git repositories for `backend` and `frontend`, so each repo has its own GitHub Actions workflow:

- `backend/.github/workflows/docker-publish.yml`
- `frontend/.github/workflows/docker-publish.yml`

Each workflow runs on pushes to `main`. A merged pull request updates `main`, so the workflow will run after the PR is merged.

## GitHub Settings

In both GitHub repositories, add:

- Repository variable `DOCKERHUB_USERNAME`
- Repository secret `DOCKERHUB_TOKEN`

In the frontend repository, also add:

- Repository variable `VITE_SUPABASE_URL`
- Repository variable `VITE_SUPABASE_PUBLISHABLE_KEY`
- Optional repository variable `VITE_FRONTEND_ORIGIN`

The frontend calls `/api` on its own origin. Its Nginx container proxies those
requests to the backend container, so the backend does not need a public port.

The backend workflow publishes:

- `${DOCKERHUB_USERNAME}/classmatch-backend:latest`
- `${DOCKERHUB_USERNAME}/classmatch-backend:<commit-sha>`

The frontend workflow publishes:

- `${DOCKERHUB_USERNAME}/classmatch-frontend:latest`
- `${DOCKERHUB_USERNAME}/classmatch-frontend:<commit-sha>`

## Home Server

On the home server, set `DOCKERHUB_USERNAME` in the same directory as `docker-compose.prod.yml`, then run:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Watchtower checks Docker Hub every 60 seconds. When either `latest` image changes, it pulls the new image and recreates the matching container.
