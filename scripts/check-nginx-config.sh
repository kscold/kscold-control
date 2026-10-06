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

# 예제 설정이 참조하는 인증서 도메인을 직접 읽어 준비한다.
# 목록을 손으로 맞추면 예제를 추가할 때마다 검사가 깨진다.
while IFS= read -r domain; do
  mkdir -p "${test_root}/ssl/${domain}"
  cp "${test_root}/privkey.pem" "${test_root}/ssl/${domain}/privkey.pem"
  cp "${test_root}/fullchain.pem" "${test_root}/ssl/${domain}/fullchain.pem"
done < <(grep -hoE '/etc/nginx/ssl/[^/]+/' "${test_root}"/conf.d/*.conf | cut -d/ -f5 | sort -u)

# 업스트림 호스트도 같은 방식으로 모아 검사용 컨테이너 안에서 이름이 풀리게 한다.
add_host_args=()
while IFS= read -r upstream_host; do
  add_host_args+=(--add-host "${upstream_host}:127.0.0.1")
done < <(
  grep -hoE 'proxy_pass https?://[A-Za-z0-9._-]+' "${test_root}"/conf.d/*.conf |
    sed -E 's#.*://##' |
    sort -u
)

docker run --rm \
  ${add_host_args[@]+"${add_host_args[@]}"} \
  --volume "${test_root}/nginx.conf:/etc/nginx/nginx.conf:ro" \
  --volume "${test_root}/conf.d:/etc/nginx/conf.d:ro" \
  --volume "${test_root}/ssl:/etc/nginx/ssl:ro" \
  "${NGINX_IMAGE}" nginx -t
