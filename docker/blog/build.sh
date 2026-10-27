#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
df -h "$HOME"
available_kib=$(df -Pk "$HOME" | awk 'NR==2 { print $4 }')
if [[ ! "$available_kib" =~ ^[0-9]+$ ]] || (( available_kib < 15 * 1024 * 1024 )); then
  echo '호스트 여유 공간이 15GiB 미만이거나 확인에 실패하여 빌드를 중단합니다.' >&2
  exit 1
fi
repo=${1:?블로그 git 저장소 경로가 필요합니다}
ref=${2:-$(cat "$root/source-revision")}
tag=${3:-kscold/ubuntu-blog:$(date +%F)}
case "$tag" in
  kscold/ubuntu-blog:20??-??-??*) ;;
  *) echo '날짜 태그만 허용합니다. latest는 덮어쓰지 않습니다.' >&2; exit 1 ;;
esac
if image_status=$(docker image inspect "$tag" 2>&1); then
  echo '이미 존재하는 태그입니다. 새 날짜/접미사를 사용하세요.' >&2
  exit 1
elif [[ "$image_status" != *'No such image'* && "$image_status" != *'No such object'* ]]; then
  echo '이미지 존재 여부를 확인하지 못했습니다. Docker 상태를 복구한 뒤 다시 실행하세요.' >&2
  exit 1
fi
revision=$(git -C "$repo" rev-parse --verify "${ref}^{commit}")
stage=$(mktemp -d "${TMPDIR:-/tmp}/blog-image-source.XXXXXX")
trap 'rm -rf "$stage"' EXIT
# 추적하지 않는 운영 설정·개인 문서가 빌드 컨텍스트에 섞이지 않게 한다.
git -C "$repo" archive "$revision" | tar -x -C "$stage"
docker buildx build --load --platform linux/arm64 \
  --build-context "blog=$stage" --build-arg "BLOG_REVISION=$revision" \
  --build-arg "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-/api}" \
  --build-arg "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-https://kscold.com}" \
  --build-arg "NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID:-}" \
  --build-arg "NEXT_PUBLIC_ADSENSE_ID=${NEXT_PUBLIC_ADSENSE_ID:-}" \
  --tag "$tag" "$root"
printf '이미지: %s\n블로그 커밋: %s\n' "$tag" "$revision"
