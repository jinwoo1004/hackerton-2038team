#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
env_file="${DEPLOY_ENV_FILE:?Set DEPLOY_ENV_FILE to the absolute path of your external deployment env file}"
if [[ "$env_file" != /* || ! -f "$env_file" ]]; then
  printf '%s\n' 'DEPLOY_ENV_FILE must be an existing absolute file path.' >&2
  exit 2
fi
env_file="$(realpath -- "$env_file")"
if [[ "$env_file" == "$repo_dir"/* ]]; then
  printf '%s\n' 'Keep deployment secrets outside the Git checkout.' >&2
  exit 2
fi
mode="${1:-tls}"
config=(-f "$repo_dir/deploy/compose.yml")
case "$mode" in
  tls) config+=(-f "$repo_dir/deploy/compose.tls.yml") ;;
  loopback) ;;
  *) printf '%s\n' 'Usage: bash deploy/up.sh [tls|loopback]' >&2; exit 2 ;;
esac
command -v docker >/dev/null || { printf '%s\n' 'Docker Engine and Docker Compose v2 are required.' >&2; exit 2; }
export DEPLOY_IMAGE_TAG="${DEPLOY_IMAGE_TAG:-$(git -C "$repo_dir" rev-parse --short=12 HEAD)}"
compose=(docker compose --project-name monitoring-2038 --env-file "$env_file" "${config[@]}")
# Never print the interpolated config: it contains runtime secrets.
"${compose[@]}" config --quiet
"${compose[@]}" up -d --build --wait --wait-timeout 240
"${compose[@]}" ps
