# ClassMatch CI/CD and deployment

ClassMatch uses one GitHub Actions workflow at `.github/workflows/ci-cd.yml`.

Pull requests and pushes to `main` run:

- Frontend lint and production build
- Flask unit tests
- Deployment shell syntax checks

After all checks pass on `main`, the workflow publishes these Docker Hub images:

- `${DOCKERHUB_USERNAME}/classmatch-backend:latest`
- `${DOCKERHUB_USERNAME}/classmatch-backend:<commit-sha>`
- `${DOCKERHUB_USERNAME}/classmatch-frontend:latest`
- `${DOCKERHUB_USERNAME}/classmatch-frontend:<commit-sha>`

Production deployments use the immutable commit-SHA tags. The backend API and worker use the same backend image and release version.

## GitHub publishing configuration

Create these repository variables under **Settings -> Secrets and variables -> Actions -> Variables**:

- `DOCKERHUB_USERNAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_FRONTEND_ORIGIN` (optional)

Create this repository secret under **Actions -> Secrets**:

- `DOCKERHUB_TOKEN`

Until the required repository variables are configured, the test jobs still run but image publishing and deployment are skipped.

## Production configuration

On the deployment host, copy `.env.example` to `.env` beside `docker-compose.prod.yml`. Set:

```dotenv
DOCKERHUB_USERNAME=your-dockerhub-username
RELEASE_VERSION=the-full-commit-sha-to-deploy
```

Keep the Flask runtime secrets in `backend/.env`. Neither `.env` file should be committed.

Manual deployment remains available:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans --wait
docker compose -f docker-compose.prod.yml ps
```

## Automated deployment with a self-hosted runner

After both commit-SHA images are published, `deploy-production` runs locally on the production machine. It targets only a runner with the labels `self-hosted`, `linux`, and `production`, and invokes `/opt/classmatch/deployment/deploy.sh "$GITHUB_SHA"`. The job does not check out the repository or receive deployment credentials. The deployment script pulls both images, waits for their Compose health checks, records the successful release, and attempts to restore the previous successful SHA if deployment fails.

### 1. Prepare the production host

Install Docker Engine, the Docker Compose plugin, Git, and `flock` (normally provided by `util-linux`). Check out this repository at `/opt/classmatch`, then configure `/opt/classmatch/.env` and `/opt/classmatch/backend/.env` as described above.

Create a dedicated service account for the runner and grant it Docker access. Docker group membership is effectively root-level access, so keep the host restricted and the checkout owned by an administrator:

```bash
sudo useradd --create-home --shell /bin/bash classmatch-runner
sudo usermod --append --groups docker classmatch-runner
sudo chown -R root:root /opt/classmatch
sudo chmod 0755 /opt/classmatch/deployment/deploy.sh
sudo chown root:classmatch-runner /opt/classmatch/.env /opt/classmatch/backend/.env
sudo chmod 0640 /opt/classmatch/.env /opt/classmatch/backend/.env
```

If the Docker Hub repositories are private, authenticate Docker Hub for `classmatch-runner` on the production host. Create the deployment state directory for the same account:

```bash
sudo install -d -o classmatch-runner -g classmatch-runner -m 0700 /var/lib/classmatch-deploy
```

### 2. Install and register the runner

In the repository's **Settings -> Actions -> Runners**, create or select a dedicated runner group restricted to this repository. Follow GitHub's generated Linux runner commands to download and configure the runner under the `classmatch-runner` account. During configuration:

- Add the labels `self-hosted`, `linux`, and `production`.
- Place the runner in the dedicated repository-restricted runner group.
- Configure the runner as a service that starts as `classmatch-runner`.

Restrict the runner group so only this repository can use it, and ensure that only the `deploy-production` job targets the `production` label. PR jobs must continue to use GitHub-hosted `ubuntu-latest` runners. Self-hosted runners are not isolated from workflows that run on them, so never target this runner with untrusted pull-request jobs.

### 3. Configure GitHub protection

Configure the `production` environment to allow deployments only from `main` and optionally require manual approval. Keep the existing production deployment concurrency group so only one deployment can run at a time. The workflow's `publish` job remains on `ubuntu-latest` and must complete successfully before the local deployment job starts.

### 4. Maintain the trusted checkout

The production runner uses the trusted checkout at `/opt/classmatch`; the deploy job intentionally does not check out the repository. When `deployment/deploy.sh` or `docker-compose.prod.yml` changes, update `/opt/classmatch` administratively before deploying a release that depends on those changes, verify ownership and permissions, and restart the runner service if its installation or configuration changed. Application code itself is delivered in the immutable Docker images.

## Rollback

Automated deployment records the last successful SHA in `/var/lib/classmatch-deploy/current-release` and attempts to restore it when a new deployment fails. To roll back manually, run:

```bash
sudo -u classmatch-runner /bin/bash /opt/classmatch/deployment/deploy.sh <previous-full-commit-sha>
```

Because both application images are tagged with the same commit SHA, the frontend, API, and worker roll back as one release.
