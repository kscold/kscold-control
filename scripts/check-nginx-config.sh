#!/usr/bin/env bash

set -euo pipefail

readonly NGINX_IMAGE='nginx@sha256:1d13701a5f9f3fb01aaa88cef2344d65b6b5bf6b7d9fa4cf0dca557a8d7702ba'
readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly test_root="$(mktemp -d "${repository_root}/.nginx-check.XXXXXX")"

cleanup() {
  rm -rf "${test_root:?}"
}
trap cleanup EXIT

mkdir -p "${test_root}/conf.d" "${test_root}/ssl"
cp "${repository_root}/nginx/nginx.conf" "${test_root}/nginx.conf"

for config_path in "${repository_root}"/nginx/conf.d/*.conf.example; do
  config_name="$(basename "${config_path}" .example)"
  cp "${config_path}" "${test_root}/conf.d/${config_name}"
done

openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -subj '/CN=localhost' \
  -keyout "${test_root}/privkey.pem" \
  -out "${test_root}/fullchain.pem" >/dev/null 2>&1

for domain in app.example.com gole.kscold.com kscold.com; do
  mkdir -p "${test_root}/ssl/${domain}"
  cp "${test_root}/privkey.pem" "${test_root}/ssl/${domain}/privkey.pem"
  cp "${test_root}/fullchain.pem" "${test_root}/ssl/${domain}/fullchain.pem"
done

docker run --rm \
  --add-host ubuntu-app:127.0.0.1 \
  --add-host ubuntu-blog:127.0.0.1 \
  --volume "${test_root}/nginx.conf:/etc/nginx/nginx.conf:ro" \
  --volume "${test_root}/conf.d:/etc/nginx/conf.d:ro" \
  --volume "${test_root}/ssl:/etc/nginx/ssl:ro" \
  "${NGINX_IMAGE}" nginx -t
