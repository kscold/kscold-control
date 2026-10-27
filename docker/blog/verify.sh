#!/bin/bash
set -euo pipefail
container=${1:-ubuntu-blog-verify}
root=$(cd "$(dirname "$0")" && pwd)
case "$container" in ubuntu-blog-verify*) ;; *) echo '검증 컨테이너 이름만 허용함' >&2; exit 1 ;; esac
# inspect 값은 파이프로만 전달하며 환경 변수 값은 출력하지 않는다.
docker inspect "$container" | python3 -c '
import json,sys
x=json.load(sys.stdin)[0]
assert x["HostConfig"]["NetworkMode"].startswith("blog-verify-"), "검증 네트워크 필요"
assert set(x["NetworkSettings"]["Networks"])=={x["HostConfig"]["NetworkMode"]}, "추가 네트워크 연결 금지"
mounts={m["Destination"]:m for m in x["Mounts"]}
for path in ["/data/db","/app/uploads","/qdrant/storage","/qdrant/snapshots"]:
    m=mounts[path]
    assert m["Type"]=="volume" and m["Name"].startswith("blog-verify-"), "검증 볼륨 필요"
'
network=$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")
test "$(docker network inspect --format '{{.Internal}}' "$network")" = true
docker exec "$container" /opt/agent-venv/bin/python /usr/local/lib/blog/healthcheck.py
docker exec -e BLOG_VERIFY=1 -i "$container" /opt/agent-venv/bin/python < "$root/verify-runtime.py"
before_mongo=$(docker exec "$container" supervisorctl pid mongod)
before_qdrant=$(docker exec "$container" supervisorctl pid qdrant)
docker exec "$container" supervisorctl restart api web agent
test "$before_mongo" = "$(docker exec "$container" supervisorctl pid mongod)"
test "$before_qdrant" = "$(docker exec "$container" supervisorctl pid qdrant)"
for attempt in $(seq 1 90); do
  if docker exec "$container" /opt/agent-venv/bin/python /usr/local/lib/blog/healthcheck.py >/dev/null; then
    echo 'PASS app restart preserved MongoDB/Qdrant PIDs and restored health'
    exit 0
  fi
  sleep 1
done
echo '앱 재시작 후 healthcheck 실패' >&2
exit 1
