#!/usr/bin/env bash
set -Eeuo pipefail

release_sha="${1:-}"
if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "A full lowercase Git commit SHA is required." >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="${CLASSMATCH_PROJECT_DIR:-$(cd -- "$script_dir/.." && pwd)}"
state_dir="${DEPLOY_STATE_DIR:-/var/lib/classmatch-deploy}"
compose_file="$project_dir/docker-compose.prod.yml"
env_file="$project_dir/.env"
current_release_file="$state_dir/current-release"

if [[ ! -f "$compose_file" || ! -f "$env_file" ]]; then
  echo "Missing $compose_file or $env_file." >&2
  exit 1
fi

mkdir -p -- "$state_dir"
previous_release=""
if [[ -f "$current_release_file" ]]; then
  previous_release="$(tr -d '[:space:]' < "$current_release_file")"
fi

deploy_release() {
  local sha="$1"
  export RELEASE_VERSION="$sha"
  docker compose --env-file "$env_file" -f "$compose_file" pull &&
    docker compose --env-file "$env_file" -f "$compose_file" up \
      -d --remove-orphans --wait --wait-timeout 180
}

if ! deploy_release "$release_sha"; then
  echo "Deployment of $release_sha failed." >&2
  if [[ "$previous_release" =~ ^[0-9a-f]{40}$ && "$previous_release" != "$release_sha" ]]; then
    echo "Rolling back to $previous_release." >&2
    deploy_release "$previous_release" || echo "Automatic rollback failed." >&2
  fi
  exit 1
fi

temporary_release_file="$(mktemp "$state_dir/current-release.XXXXXX")"
printf '%s\n' "$release_sha" > "$temporary_release_file"
mv -f -- "$temporary_release_file" "$current_release_file"
docker compose --env-file "$env_file" -f "$compose_file" ps
echo "Deployment of $release_sha completed."
