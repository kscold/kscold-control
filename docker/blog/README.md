# ubuntu-blog 통합 이미지

Ubuntu 위에서 API, Next standalone, MongoDB, Vault Agent, Qdrant를 별도 Supervisor 프로그램으로 실행한다. `compose.yaml`은 교체 검토용 정의이며 자동 배포하지 않는다. 운영 설정과 데이터는 이미지에 포함하지 않는다.

## 버전과 빌드

| 구성 | 고정 버전 | 선택 근거 |
| --- | --- | --- |
| Ubuntu | 24.04 LTS + 이미지 digest | 기존 22.04에서 LTS 기반 갱신 |
| Node | 26.12.1 + 이미지 digest | 프런트 업그레이드 담당자의 실행 환경과 일치. 2026-10-27 기준 Current이며 LTS로 표기하지 않음 |
| Java 런타임 | Temurin 25.0.5+8 JRE + SHA-256 | 백엔드 담당자의 Java 25 LTS 결정 반영 |
| Java 빌드 | Temurin 21.0.13+9 JDK + SHA-256 | 현재 main의 Gradle 8.14.5 / Java 21 소스 호환. Java 25 소스가 main에 반영되면 빌더도 함께 변경 |
| MongoDB | 8.0.34 | 지정된 8.0 계열의 패치 고정 |
| MongoDB 도구 | mongosh 2.14.0, database-tools 100.20.0 | 서버와 별도로 고정 |
| Python | CPython 3.13.18 + SHA-256, `/opt/agent-venv` | Agent 담당자의 3.13 결정 반영 |
| Qdrant | 1.19.0 공식 ARM64 바이너리 + SHA-256 | 기존 데이터 형식을 먼저 검증. 1.20 이전은 별도 작업 |

근거: [Node 릴리스](https://nodejs.org/en/blog/release/v26.12.1), [Temurin 지원](https://adoptium.net/support/), [Python 릴리스](https://www.python.org/downloads/release/python-31318/), [Qdrant 릴리스](https://github.com/qdrant/qdrant/releases/tag/v1.19.0).

대상은 운영 호스트와 같은 `linux/arm64`다. 다른 아키텍처는 명시적으로 실패한다. 기본 소스 커밋은 `source-revision`에 고정한다. 빌드 전에 블로그 저장소에서 `git fetch origin main`을 실행하고, 다음처럼 커밋을 지정한다.

```bash
export DOCKER_HOST=unix:///Users/kscold/.colima/default/docker.sock
bash docker/blog/build.sh /path/to/kscold-blog-version-2 COMMIT_SHA kscold/ubuntu-blog:2026-10-27-r1
```

스크립트는 `git archive`로 추적 파일만 추출한다. `.env.local`, `application-prod.yml`, private 문서, 배포 overlay, macOS node_modules는 컨텍스트에 들어가지 않는다. 기존 태그와 `latest` 덮어쓰기를 거부한다. 공개 저장소의 블로그 코드만 포함하므로 **git 밖 전용 페이지/강의 대본/개인 자료의 운영 동등성은 보장하지 않는다**. 이런 자산은 교체 전에 별도 런타임 마운트 및 경로를 확인해야 한다.

Next는 [CLI의 compile 모드](https://nextjs.org/docs/app/api-reference/cli/next)와 generate-env를 사용한다. 빌드 중 운영 API를 조회하거나 CI 가짜 콘텐츠를 이미지에 저장하지 않는다. lint와 타입 검사를 별도로 실행하고, 실제 데이터는 최초 요청에서 렌더링한다. 실험적 빌드 옵션이므로 Next 메이저 변경 때 standalone·SSR·클라이언트 번들을 다시 검증해야 한다. `API_INTERNAL_URL=http://127.0.0.1:8080/api`가 SSR 주소이고 브라우저는 `/api`를 사용한다. 앞단 nginx가 `/api`를 API로 전달해야 한다.

Supervisor 4.2.5-1ubuntu0.1과 tini 0.19.0-1을 고정하고 Agent 전이 의존성도 `agent-requirements.lock`에 고정한다. 블로그 Agent 요구사항과 잠금 파일이 다르면 빌드가 실패하므로 함께 갱신한다. Ubuntu 일반 라이브러리는 보안 저장소의 업데이트를 받으므로 비트 단위 재현은 보장하지 않는다. 이미지의 `/usr/local/lib/blog/os-packages.txt`, `/app/agent/requirements.resolved.txt`와 최종 이미지 ID를 함께 보관한다.

## 경로, 프로세스, 권한

| 프로그램 | 경로 | 사용자 | 포트 |
| --- | --- | --- | --- |
| api | `/app/backend/blog.jar`, 호환용 `/app/backend/.env` | 10001:10001 | 8080 |
| web | `/app/frontend/apps/web/server.js` | 10001:10001 | 3000 |
| agent | `/app/agent/src`, `/opt/agent-venv` | 10001:10001 | 9090, 외부에 게시하지 않음 |
| mongod | `/data/db` | UID 999, 보조 그룹 999 | 127.0.0.1:27017, 인증 필수 |
| qdrant | `/qdrant/storage`, `/qdrant/snapshots` | 1000:1000 | 127.0.0.1:6333/6334 |
| 업로드 | `/app/uploads` | 10001:10001 | 해당 없음 |

Supervisor와 tini만 root로 실행한다. API launcher가 root 전용 `.env`를 읽은 후 권한을 낮춘다. 런타임 env가 `.env`보다 우선한다. Supervisor의 소켓은 `/run/blog/supervisor.sock`, mode 0700이다. 시작 시 데이터 소유권·FCV·사용자를 변경하지 않는다. 기존 root 소유 MongoDB 데이터는 **정지한 복사본**에 한해 999:999로 이전해야 한다.

모든 프로그램 로그는 stdout/stderr이며 `docker logs`로 읽는다. Compose는 20 MB × 5개로 로그를 제한한다. 파일 로그 및 PM2 로그는 새로 만들지 않는다. `healthcheck.py`는 API `/api/health`, web `/`, Qdrant `/readyz`, Agent gRPC 채널 연결을 확인한다. Agent 연결 확인은 모델 응답의 정확성을 보장하지 않는다.

```bash
docker exec ubuntu-blog supervisorctl status
docker exec ubuntu-blog supervisorctl restart api web agent
```

`restart all`, `reload`, 컨테이너 재시작은 코드 배포 명령으로 사용하지 않는다. 위의 세 프로그램 재시작은 mongod·qdrant를 건드리지 않는다. 종료 순서는 web → api → agent → 데이터 저장소이며 MongoDB 종료 대기 90초, Qdrant 60초, 컨테이너 전체 유예 180초다.

기존 sshd가 2225에서 대기하지만 조사 시 활성 SSH 세션은 없고 배포 overlay는 `docker cp/exec`를 사용했다. 새 이미지에는 sshd와 cron을 설치하지 않는다. 2225를 사용하는 별도 운영 도구가 있다면 교체 전에 Docker exec 방식으로 바꿔야 한다. 기존 cron에는 e2scrub 작업만 있었고 cron 데몬은 실행되지 않았다. MongoDB 호스트 포트 27019도 게시하지 않는다.

## 메모리

기존 세 컨테이너의 관측 사용량은 약 1.25 GiB + 184 MiB + 106 MiB였다. 별도 Agent/Qdrant에는 제한이 없었다. 통합 한도는 4 GiB, CPU 3개로 잡고 Java heap 768 MiB, Node heap 512 MiB, WiredTiger cache 512 MiB를 지정했다. 나머지는 JVM native 메모리, Python, Qdrant, 파일 캐시 여유다. Qdrant와 Python 자체의 강제 한도는 없으며 전체 cgroup 한도를 공유한다. 병렬 Agent 요청·재색인·대용량 첨부는 이 스모크 검증 범위 밖이므로 실제 부하에서 OOM과 지연을 관찰한다.

## 안전한 검증

운영 볼륨을 쓰기 가능하게 검증 컨테이너에 붙이지 않는다. MongoDB는 승인된 archive를 새 MongoDB 7 볼륨에 복원하고 FCV 7.0을 확인한 뒤 정상 종료한다. 이 볼륨만 MongoDB 8에 연결한다. Qdrant 1.19 저장소·스냅샷과 업로드는 원본을 `readonly`로 마운트한 복사 도우미를 사용한다. 실행 중인 Qdrant 파일 복사본은 리허설 자료이며 최종 이전 백업으로 사용하지 않는다. 최종 교체는 정지 후 복사한다.

검증 이름은 `ubuntu-blog-verify`, 데이터 볼륨은 `blog-verify-*`, 네트워크는 새 `--internal` 네트워크를 사용한다. localhost 13002/18083을 게시하더라도 Colima의 internal 네트워크에서는 호스트 접근이 차단될 수 있다. 이때 새 검증 프록시만 별도 edge 네트워크에도 연결하고 localhost 13003에서 API/web을 프록시한다. 통합 컨테이너는 internal 네트워크에만 두며 운영 네트워크에 연결하지 않는다. 별도의 mode 600 env 파일에 임의 JWT/MongoDB 자격증명과 가짜 OpenAI 키를 넣고 Discord 토큰, SMTP 자격증명, IndexNow 키는 비운다. 알림·메일·결제·웹 검색을 끄고 OpenAI/SMTP/MinIO 주소를 접근 불가능한 loopback 주소로 둔다. 네트워크의 egress 차단을 함께 검증한다.

앱을 시작하기 전 `API_AUTOSTART=false`, `WEB_AUTOSTART=false`, `AGENT_AUTOSTART=false`로 데이터 저장소만 시작한다. `counts.py`를 컨테이너의 Python stdin으로 실행해 archive와 컬렉션별 수가 정확히 같은지 비교한다. Qdrant 컬렉션/포인트 수, FCV 7.0도 확인한다. 그 후 `supervisorctl start api web agent`로 앱을 시작한다. GET 글 조회도 조회수/로그를 쓸 수 있으므로 반드시 복사본에서만 수행한다.

```bash
docker exec -i ubuntu-blog-verify /opt/agent-venv/bin/python < docker/blog/counts.py
docker exec ubuntu-blog-verify supervisorctl start api web agent
docker exec ubuntu-blog-verify /opt/agent-venv/bin/python /usr/local/lib/blog/healthcheck.py
bash docker/blog/verify.sh ubuntu-blog-verify
```

글 상세, 관리자 로그인 화면, Vault, 인증된 관리자 채팅 GET, Agent 검색을 확인하고 `supervisorctl restart api web agent` 전후 mongod/qdrant PID가 같은지도 확인한다. 외부 모델 호출을 차단했으므로 실제 LLM 답변 품질은 이 검증으로 인증하지 않는다.

## 운영 교체 런북 — 이 작업에서는 실행하지 않음

아래는 운영 교체 담당자가 실행할 절차다. 새 이미지와 Compose 파일을 준비하는 작업은 여기서 끝나며, 운영 stop·rename·nginx reload·compose up은 자동 실행하지 않는다.

### 사전 준비

1. 이미지 ID와 블로그 커밋, Agent·프런트 최종 결과를 대조한다. 나중에 main이 변경되면 새 날짜 접미사로 다시 빌드/검증한다. 기존 이미지 `latest`는 보존한다.
2. `runtime.env.example`의 항목과 기존 Docker env, PM2 env, `/app/backend/.env`를 운영자가 비공개 파일에 합친다. `MONGODB_URI`는 인증 정보를 유지하고 호스트만 127.0.0.1로 바꾼다. `OPENAI_API_KEY`도 기존 Agent에서 런타임으로 전달한다. 값은 터미널/PR에 출력하지 않는다.
3. 관리자 권한으로 원본 MongoDB의 FCV가 7.0인지 확인한다. 앱 계정으로 `getParameter`가 거부될 수 있다. FCV가 다르면 교체를 중단한다.
4. `umask 077`로 비공개 백업 폴더를 만든다. 기존 컨테이너 inspect/env/PM2 설정, backend JAR·`.env`, frontend standalone, 별도 Agent 이미지 ID, Qdrant 이미지 ID, nginx 설정을 보관한다. 전체 mongodump에는 admin 사용자/역할도 포함한다. 현재 제공된 블로그 DB archive만으로는 운영 인증을 복구할 수 없다.
5. 원본 MongoDB/Qdrant 볼륨을 보존하는 **새 볼륨으로의 전환**을 권장한다. Compose의 기본 이름은 기존 볼륨과 호환되지만, `BLOG_MONGO_VOLUME` 등으로 새 볼륨을 지정하면 롤백 시 원래 7.0 데이터를 그대로 사용할 수 있다. 두 mongod/Qdrant를 같은 볼륨에 동시에 실행하지 않는다.

### 정지, 최종 복사, 시작

쓰기를 차단한 뒤 최종 백업과 복사를 시작한다. 기존 Agent와 API를 정지해야 Qdrant·MongoDB에 새 쓰기가 생기지 않는다. 아래 명령은 해당 담당자가 교체 시점에만 실행한다.

```bash
docker stop --timeout 30 kscold-vault-agent
docker exec ubuntu-blog pm2 stop kscold-blog-backend kscold-blog-frontend
docker exec ubuntu-blog sh -c 'kill -TERM "$(pidof mongod)"'
# mongod 프로세스가 사라지고 로그에 정상 종료가 기록되었는지 확인한다.
docker stop --timeout 60 ubuntu-blog
docker stop --timeout 60 kscold-vault-qdrant
```

원본 4개 볼륨을 각각 `readonly`로 마운트하여 **비어 있는** 새 cutover 볼륨에 `cp -a`한다. 대상이 비어 있지 않으면 중단한다. 새 MongoDB 볼륨만 `chown -R 999:999`, 새 업로드 볼륨만 `chown -R 10001:10001`, 새 Qdrant 저장소/스냅샷만 `chown -R 1000:1000`한다. 원본에는 쓰지 않는다. 복사본 크기·권한과 파일 백업 checksum을 기록한다.

```bash
export BLOG_IMAGE=kscold/ubuntu-blog:2026-10-27-r1
export BLOG_ENV_FILE=/absolute/private/path/blog.env
export BLOG_MONGO_VOLUME=blog-cutover-mongo-20261027
export BLOG_UPLOADS_VOLUME=blog-cutover-uploads-20261027
export BLOG_QDRANT_VOLUME=blog-cutover-qdrant-20261027
export BLOG_SNAPSHOTS_VOLUME=blog-cutover-snapshots-20261027
docker rename ubuntu-blog ubuntu-blog-before-20261027
docker compose -f docker/blog/compose.yaml config --quiet
docker compose -f docker/blog/compose.yaml up -d ubuntu-blog
docker exec ubuntu-blog /opt/agent-venv/bin/python /usr/local/lib/blog/healthcheck.py
docker exec kscold-nginx nginx -t
docker exec kscold-nginx nginx -s reload
```

healthcheck가 성공하기 전 nginx를 전환하지 않는다. nginx의 `ubuntu-blog:3000/8080` 주소는 유지되며 reload로 새 IP를 해석하게 한다. 백업 수와 최종 복사본 수를 대조하고 글/Vault/채팅 읽기와 Agent 연결을 확인한 다음 쓰기를 다시 허용한다. 이전 Agent와 Qdrant는 계속 정지 상태로 보존한다.

다운타임 목표는 1분 이내지만 standalone 저장소를 최종 복사하고 JVM을 시작하는 시간이 포함되어 보장할 수 없다. 사전에 이미지 로드·설정 검사·권한 이전 시간 측정을 마친다. 복사가 길면 수 분의 점검 시간을 예약한다. 더 짧은 전환은 독립 볼륨의 candidate를 미리 띄우고 쓰기를 동결한 뒤 최종 동기화/검증 후 nginx upstream을 전환하는 방식으로 별도 설계한다. 실행 중인 두 DB가 같은 디렉터리를 공유하는 방식은 사용하지 않는다.

루트의 로컬 `docker-compose.yml`은 공개 추적 제외 파일이다. 운영 담당자는 교체 때 기존 ubuntu-blog 서비스를 새 정의와 일치시키거나 제거하고 이 전용 파일을 유일한 관리 경로로 정해야 한다. 구 정의를 포함한 전체 `up`으로 이전 이미지를 다시 생성하지 않도록 한다.

### FCV 관찰 기간과 롤백

MongoDB 7 → 8은 [FCV 7.0인 7.0 서버를 정상 종료한 뒤 8.0 바이너리를 사용하는 절차](https://www.mongodb.com/docs/v8.0/release-notes/8.0-upgrade-standalone/)를 따른다. 엔트리포인트는 FCV를 올리지 않는다. 이 배포에서는 최소 7일 관찰하고 백업·조회·인덱스·쓰기 동작 확인 후 별도 결정으로 FCV 8.0을 활성화한다.

**FCV 7.0 유지가 Community Edition의 바이너리 다운그레이드를 지원하게 만들지는 않는다.** [MongoDB 8.0 공식 문서](https://www.mongodb.com/docs/v8.0/release-notes/8.0-downgrade/)는 Community의 바이너리 다운그레이드를 지원하지 않는다. 8.0이 연 파일을 7.0으로 다시 여는 롤백은 사용하지 않는다.

위의 새 볼륨 전환 방식이면 원본 데이터와 컨테이너가 그대로 남는다. 문제가 있으면 쓰기를 막고 다음 순서로 되돌린다.

```bash
docker stop --timeout 180 ubuntu-blog
docker rename ubuntu-blog ubuntu-blog-failed-20261027
docker rename ubuntu-blog-before-20261027 ubuntu-blog
docker start kscold-vault-qdrant
docker start ubuntu-blog
docker exec ubuntu-blog pm2 start kscold-blog-backend kscold-blog-frontend
docker start kscold-vault-agent
# 기존 API/web 상태 확인 후 DNS를 다시 해석한다.
docker exec kscold-nginx nginx -t
docker exec kscold-nginx nginx -s reload
```

이 롤백은 cutover 이후 새 볼륨에 기록된 데이터를 원본에 자동 합치지 않는다. 쓰기 허용 후 문제가 생기면 새 볼륨을 보존하고 신규 데이터 이관/RPO를 먼저 판단한다. 같은 기존 볼륨에서 직접 업그레이드했다면 위 명령을 사용할 수 없다. 사전 cold backup을 **새** 볼륨에 복원하고 원래 실행 설정과 앱 산출물로 7.0 컨테이너를 재구성해야 한다.

## 배포 overlay 변경 사항

블로그 저장소의 추적 제외 `scripts/deploy-live-container.sh`는 이번 작업에서 수정하지 않는다. 운영 교체 담당자는 다음을 반영해야 한다.

- `pm2 restart kscold-blog-backend` → `supervisorctl restart api`, frontend → `web`. `pm2 save/list`는 제거하고 `supervisorctl status`로 확인한다.
- Agent 소스/가상환경을 업데이트한 경우에만 `supervisorctl restart agent`를 실행한다. DB 두 프로그램은 코드 배포에서 제외한다.
- API는 Java 25로 이관된 소스가 반영되면 Gradle 9와 JDK 25로 빌드한다. 기존 Java 21 전용 이미지/변수도 함께 갱신한다.
- 프런트는 Linux ARM64에서 새 Node/pnpm lockfile로 빌드한다. macOS sharp 패키지 수동 보강을 계속하기보다 이 Dockerfile의 Linux 산출물을 사용한다.
- `/app/backend/blog.jar`, `/app/backend/.env`, `/app/frontend/apps/web/server.js`, `/app/uploads` 경로를 유지한다. `docker cp`로 root 소유 파일을 덮어썼다면 읽기 권한과 10001 소유 캐시 디렉터리를 확인한다.
- 교체 파일은 임시 경로로 복사하고 권한을 맞춘 후 rename한다. web의 node_modules를 지우기 전에 `supervisorctl stop web`을 실행하고 복원 후 start한다.
- PM2 kill timeout 대신 Supervisor의 API stopwaitsecs 30초를 따른다. 기존 QA 러너 갱신 경로는 별도로 확인한다.

Qdrant 1.20 서버/클라이언트 이전과 운영 nginx 설정 변경은 이 PR에 포함되지 않는다.

## CI

`Blog image` 워크플로는 GitHub의 ARM64 러너에서 고정한 공개 소스만 체크아웃하여 이미지를 빌드하고 런타임 실행 파일을 확인한다. 운영 데이터·환경 파일·키를 사용하지 않으며 이미지를 레지스트리에 푸시하지 않는다. 운영 복사본 데이터 검증은 위 로컬 절차로 별도 수행한다.
