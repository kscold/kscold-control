# ubuntu-blog 통합 이미지

API·Next standalone·Agent·MongoDB·Qdrant를 별도 Supervisor 프로그램으로 실행한다. 이 Compose는 교체 검토용이며 자동 배포하지 않는다. 운영 시크릿과 비공개 overlay는 이미지·Git에 넣지 않는다.

## 현재 이미지와 다음 이미지

현재 `2026-10-27-r1`은 블로그 `50034991f6561b7147d19d0be4aa2e72b819062c`를 사용한다. Dockerfile의 소스·빌더·Qdrant 고정값은 이 기준이며, 아래 A 설정 변경은 기존 r1 이미지를 변경하지 않는다. A 복사본에는 검토한 설정과 Qdrant 바이너리를 별도로 적용해 검증한다.

최종 프런트 main 반영 후 운영자의 B 신호를 받아 다음 값을 새 날짜 태그에 반영하고 전체 리허설을 반복한다. `latest`나 기존 태그를 덮어쓰지 않는다.

| 항목 | r1 | B에서 반영할 r2 |
| --- | --- | --- |
| Ubuntu | 24.04 LTS, ARM64 | 동일 |
| Java 실행 / 빌드 | Temurin 25.0.5+8 / 21.0.13+9 | 모두 Temurin 25.0.5+8 |
| Node | 26.12.1 | 26.12.1 |
| pnpm | 고정 소스 packageManager | 12.15.0, pnpm-workspace.yaml의 overrides 포함 |
| MongoDB | 8.0.34, FCV 7.0 유지 | 동일 |
| Python | CPython 3.13.18 | 동일 버전, 최종 Agent 잠금 파일 반영 |
| Qdrant 서버 / 클라이언트 | 1.19.0 / 1.19.0 | 모두 1.20.0, query_points 사용 |

Qdrant 데이터는 원본 1.19.0을 보존한 복사본에서 **1.19.2 → 1.20.0** 순서로 이전한다. 각 단계에서 컬렉션·포인트 수·실제 벡터 검색 순위와 점수를 비교한다. 이전 데이터로의 복귀는 원래 볼륨으로 수행하며 새 형식의 파일을 이전 서버로 열지 않는다. 상세 절차는 블로그 저장소의 `apps/agent/UPGRADING.md`를 따른다.

## 포트와 자원

- 운영 이름은 `ubuntu-blog`, 네트워크는 `kscold-control_default`를 유지한다. nginx upstream은 내부 3000·8080이다.
- 호스트 포트는 기존처럼 `0.0.0.0:3002:3000`, `0.0.0.0:8083:8080`, `0.0.0.0:27019:27017`을 유지한다. sshd가 없는 2225만 제거한다.
- control 예약 백업은 `host.docker.internal:host-gateway`를 통해 27019로 접속한다. 따라서 이번 교체에서 27019를 닫거나 127.0.0.1로 좁히지 않는다. 내부망 백업 이전과 포트 축소는 별도 PR로 진행한다.
- MongoDB는 인증을 유지하고 `--bind_ip_all`로 Docker 포트 전달을 받는다. Vault 동기화의 컨테이너 내부 `127.0.0.1:27017`도 유지한다.
- CPU 3개·메모리 4GiB와 **cpu_shares 4096**을 사용한다. 기존 CPU 우선순위를 낮추지 않는다. Java heap 768MiB, Node heap 512MiB, WiredTiger cache 512MiB를 기본값으로 둔다.
- Colima의 `host.docker.internal` DNS를 사용하므로 통합 컨테이너에 extra_hosts를 추가하지 않는다. QA 러너는 호스트 3305를 사용한다.

## 환경과 파일 호환

기존 `/app/backend/.env`는 내용·권한을 보존해 복사한다. 실행에 필요한 기존 OCI/PM2/Agent 환경도 값 출력 없이 비공개 mode 600 파일로 전달한다. 이전 컨테이너가 롤백 시 그대로 사용할 원본 시크릿은 수정하지 않는다.

Supervisor는 API→Agent, web→API, Agent→Qdrant 주소를 loopback으로 덮어쓴다. launcher는 API와 Agent의 `.env`를 읽고 `BLOG_MONGODB_HOST=127.0.0.1:27017`을 적용해 MongoDB URI의 호스트 부분만 실행 환경에서 바꾼다. 사용자명·암호 인코딩·DB·authSource 등 옵션은 보존한다. 잘못된 URI나 SRV URI는 값을 출력하지 않고 실패한다.

| 프로그램 | 경로 | 사용자 | 내부 포트 |
| --- | --- | --- | --- |
| api | /app/backend/blog.jar, /app/backend/.env | 10001:10001 | 8080 |
| web | /app/frontend/apps/web/server.js | 10001:10001 | 3000 |
| agent | /app/agent/src, /opt/agent-venv | 10001:10001 | 9090 |
| mongod | /data/db | UID 999 | 27017, 인증 필수 |
| qdrant | /qdrant/storage, /qdrant/snapshots | 1000:1000 | loopback 6333·6334 |
| 업로드 | /app/uploads | 10001:10001 | 해당 없음 |

Supervisor 소켓은 `/run/blog/supervisor.sock`, mode 0700이다. 코드 배포는 api/web/agent만 갱신하고 mongod/qdrant PID를 보존한다. `restart all`, Supervisor reload, 컨테이너 재시작을 앱 배포에 사용하지 않는다. 이미지 시작 시 데이터 소유권이나 FCV를 암묵적으로 변경하지 않는다.

로컬 배포 도구는 Git 밖에 두며 기존 도구를 백업한다. standalone에 비공개 소스·자료·공개 자산·.env.local을 포함하고 macOS 빌드에는 Linux ARM64 sharp를 보강한다. 새 릴리스 디렉터리와 링크로 교체하며 실패하면 이전 릴리스로 복원한다. Docker 하위 이미지 레이어의 EXDEV에는 백업 복사를 완료한 뒤 첫 링크 전환을 수행한다. 백엔드 운영 프로필 yml을 JAR에 포함하고 기존 `.env` 해시를 보존한다. Agent의 의존성이 같으면 소스만 바꾸고 설치를 생략한다.

SEO가 게시하는 `/app/frontend/data/search-insights/index-coverage.json`은 릴리스 밖 `/app/frontend-data`로 연결한다. root 소유 mode 644로 docker cp한 파일을 UID 10001이 읽고, 다음 프런트 배포에서도 보존해야 한다. 비공개 검색 설정·지원 페이지·강사 자료는 운영 전용 overlay 검증 대상이다.

## 복사본 검증과 교체 순서

운영 컨테이너·볼륨에는 쓰지 않는다. 검증은 `ubuntu-blog-verify-*` 컨테이너, `blog-verify-*` 볼륨, 별도 internal 네트워크에서 수행한다. 외부 발송 키는 비우고 OpenAI는 접근 불가능한 loopback으로 지정한다. 검증 프록시만 별도 edge 네트워크를 사용하며 운영 nginx·네트워크를 사용하지 않는다. 다 쓴 컨테이너는 stop만 한다.

1. `df -h ~`로 호스트 여유 공간 15GiB 이상을 확인한다. 빌드·전체 테스트·대용량 다운로드 전에 반복한다. 본 작업의 빌드 캐시·임시 산출물만 단계마다 정리한다.
2. 이미지·overlay를 준비하고 원본과 다른 MongoDB·업로드·Qdrant·스냅샷 볼륨 4개를 명시한다. Compose는 새 볼륨 이름을 생략하면 실패한다.
3. 기존 서비스가 동작하는 동안 새 볼륨에 warm copy한다. 이 복사본은 아직 새 DB로 열지 않는다. 최종 복사 전 데이터 일관성을 보장하지 않는 상태다.
4. 쓰기를 차단하고 이전 Agent, API/web, MongoDB, Qdrant를 정지한다. 기존 PID 1 Python Agent는 SIGTERM을 무시할 수 있으므로 복사본에서 검증한 SIGINT 종료와 제한 시간을 사용한다. 강제 종료 여부를 확인한다.
5. 정지한 원본을 readonly로 붙여 변경 파일만 새 볼륨에 동기화하고 모든 파일 checksum을 대조한다. 대상의 불필요한 파일만 제거하며 원본에는 쓰지 않는다. 새 볼륨의 UID를 각각 999·10001·1000으로 맞춘다.
6. Qdrant 복사본을 1.19.2, 1.20.0 순서로 열어 검증하고 각 서버를 정상 종료한다. MongoDB 7의 FCV 7.0과 정상 종료도 확인한다.
7. 이전 컨테이너를 날짜가 붙은 이름으로 보존하고 새 컨테이너를 ubuntu-blog 이름·기존 네트워크로 시작한다. 준비한 overlay를 반영하고 API/web/Agent/Qdrant health를 검사한다.
8. control 내부 덤프와 host-gateway 덤프, QA 인증, Vault mongosh/mongoimport·/tmp, SEO 게시, 관리자/비공개/강사 화면, 실제 ARM64 sharp 변환을 검사한다. nginx DNS 갱신은 실제 교체 담당자가 수행한다.

다운타임 목표는 1분 이내다. 리허설은 정지 시작부터 overlay 배포와 전체 health 성공까지 측정하고, 브라우저 확인 시간은 별도로 기록한다. 실제 데이터량·부하·최종 r2 이미지에서 다시 측정하며 A 수치를 운영 보장으로 사용하지 않는다.

롤백은 새 컨테이너를 정지·이름 변경하고, 보존한 이전 컨테이너를 ubuntu-blog로 돌려 **원래 MongoDB 7/Qdrant 1.19 볼륨**으로 시작한다. MongoDB 8이 연 파일을 MongoDB 7로 열지 않는다. 새 볼륨의 전환 후 쓰기는 원본으로 자동 합쳐지지 않으므로 쓰기 재개 뒤에는 신규 데이터 이관/RPO를 판단해야 한다.

## 빌드와 CI

`build.sh`는 소스를 git archive로 추출하고 기존 이미지 태그 덮어쓰기를 거부한다. 기본 소스는 source-revision이며 B에서 최종 main 커밋과 의존성 잠금을 함께 갱신한다. Next의 compile/generate-env 모드로 운영 API를 조회하지 않고 standalone을 만든다. 최종 프런트에서 빌드 모드·공개 변수·SSR·hydration을 다시 확인한다.

PR의 Blog image 워크플로는 셸/Python 구문, 주소 보존 테스트, Compose 설정만 검사한다. 이미지 빌드와 런타임 실행 파일 검사는 B 승인 이후 workflow_dispatch로 실행한다. CI는 운영 데이터·키를 사용하거나 이미지를 레지스트리에 푸시하지 않는다.
