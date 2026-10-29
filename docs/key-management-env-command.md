# SSH forced command 환경 관리

`ssh-env-command`는 서버가 구현한 `env-v1` 프로토콜에 연결하는 KMS 공급자다.
원격 셸, 파일 경로, 실행 스크립트, 소스 revision을 DB 설정이나 API 입력으로 받지 않는다.
기존 `gcp-secret-manager`/`github-actions`, `ssh-env-file`/`ssh-blue-green` 경로를 유지한다.

## 관리 범위

GaDoc 연동 범위는 서버의 `/app/slacord-deploy/private/server.env`에 있는 백엔드 비밀값·서비스 설정 전체다
(GaDoc 저장소 `scripts/deploy/deploy-ubuntu.mjs`의 `MANAGED_ENV_KEYS`, GaDoc #159).

- 필수: `MONGODB_URI`(`mongodb://`·`mongodb+srv://`), `JWT_SECRET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`,
  `MINIO_ENDPOINT`(인증정보·경로·query·fragment 없는 HTTP(S) endpoint), `MINIO_BUCKET`(3–63자 소문자 bucket 이름)
- 선택: `MINIO_PUBLIC_URL`, `MINIO_PREPROVISIONED`, `COOKIE_SECURE`, `DISCORD_BOT_TOKEN`,
  `DISCORD_ERROR_CHANNEL_ID`, `DISCORD_SIGNUP_CHANNEL_ID`(숫자 ID), `GADOC_SAFETY_OPERATOR_IDS`,
  `GADOC_QR_LOGIN_ENABLED`, `GADOC_MOBILE_PUSH_ENABLED`, `GADOC_MOBILE_PUSH_PROJECT_ID`,
  `GADOC_MOBILE_PUSH_EXPO_ACCESS_TOKEN`, `GADOC_MOBILE_PUSH_ENCRYPTION_KEY`, `ENABLE_API_DOCS`

필수 키가 모두 있는 `server.env`는 관리 키의 정본이라, 배포 때 PM2 실행 환경에서 이어받지 않는다
(KMS에서 지운 선택 키는 다음 적용 때 실행 환경에서도 빠진다). `GADOC_PUBLIC_ORIGIN`의 `public.env`는 별도 운영 설정이다.
배포 도구가 정하는 `NODE_ENV`·`PORT`·`HOST`·`INTERNAL_API_URL`·`NEXT_PUBLIC_*`와
`NODE_OPTIONS`, `LD_PRELOAD`, `PATH` 등은 서버 allowlist에서 거절한다.
UI는 설치별 `allowedKeys`를 표시하고 백업 이력에서 적용 결과를 보여 준다.

## 프로토콜

| SSH_ORIGINAL_COMMAND                      | 입력                     | 응답                              |
| ----------------------------------------- | ------------------------ | --------------------------------- |
| `env-v1 read`                             | 없음                     | `version`, `payload`, `createdAt` |
| `env-v1 write <expectedSHA> <desiredSHA>` | UTF-8 dotenv 본문, stdin | `version`, `createdAt`            |
| `env-v1 apply <v4-UUID> <exactSHA>`       | 없음                     | `record`                          |
| `env-v1 status <v4-UUID>`                 | 없음                     | `record` 또는 `null`              |

응답은 단일 JSON 객체이며 `protocol: "env-v1"`, `ok: true`를 포함한다.
실패는 `ok: false`, 고정 오류 코드만 반환한다. 명령과 오류에 값이나 내부 로그를 싣지 않는다.
읽기 본문은 기존 reveal 권한 및 no-store API 안에서만 사용한다. 목록 응답은 값 없이 키 이름과 SHA만 반환한다.

SHA는 원본 UTF-8 바이트의 소문자 SHA-256이다. 과거 서버 파일 조회는 지원하지 않으며 복원은
Control의 AES-256-GCM 백업을 사용한다. 대상 ID와 원본 SHA를 AAD로 사용한다.
암호화 또는 DB의 사전 백업 저장 실패 시 쓰기를 시작하지 않는다. 백업 후 재조회와 서버 CAS를 모두 통과해야 한다.
Control 편집기 제한은 기존 128KiB이고 서버·stdin의 최대 허용 크기는 256KiB다.

GaDoc의 쓰기와 apply worker는 CI와 같은 영구 `deploy.lock`을 사용한다. 충돌 시 즉시 거절한다.
apply는 lock 안에서 exactSHA, current symlink, 성공 manifest, 실제 PM2 script 경로를 검사한다.
현재 소스에서 `activateRelease`의 health·revision 검사와 두 PM2 process rollback을 그대로 사용한다.
같은 release의 원본 `ecosystem.config.json`도 0600 snapshot으로 보관해 실패 시 바이트 그대로 복원한다.
snapshot과 pending journal을 내구 저장한 뒤에만 activation을 시작하고, PM2 rollback 검증이 끝나야 journal을 해제한다.
미완료 journal은 guarded entrypoint에서 앱 자동 기동만 보류하고 SSH·MongoDB는 유지한다.
부팅용 last-good ecosystem과 재시도용 desired server.env는 서로 다른 상태다.
실패 시 desired 파일을 유지해 같은 버전 재시도 또는 암호화 백업 복원을 가능하게 한다.
따라서 파일 SHA만으로 적용 성공을 판단하지 말고 UUID 상태를 확인해야 한다.
동일 UUID/버전은 기존 상태를 반환하며 재실행하지 않는다. 다른 버전으로 UUID를 재사용하면 충돌한다.
Control은 적용 UUID와 queued 의도를 원격 trigger **전에** DB에 저장한다. 이 저장이 실패하면 원격 apply는 호출하지 않는다.
ack와 상태 응답이 모두 불명인 경우 해당 UUID를 queued 상태로 유지해 연결 회복 후 재조회한다.
명시적인 서버 거절만 실패로 확정하고, 불명/실행 중 의도가 있으면 새 UUID의 중복 재시도를 막는다.
성공한 요청 재전송은 이전 성공 기록을 반환하므로 현재 적용 상태를 확인할 때 최신 백업의 UUID를 사용한다.

## 설치별 설정 계약

`key_management_targets`의 새 행은 공개 migration에 넣지 않는다. migration은 두 provider CHECK 제약만 확장한다.
infra 담당자가 기존 두 대상의 행과 권한을 유지하면서 별도 로컬 설치 절차로 새 대상을 등록한다.
아래는 설정 구조 예시이며 실행 가능한 운영 시드가 아니다.

```json
{
  "provider": "ssh-env-command",
  "deploymentProvider": "ssh-env-command",
  "envFileName": "server.env",
  "requiredKeys": [
    "MONGODB_URI",
    "JWT_SECRET",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_ENDPOINT",
    "MINIO_BUCKET"
  ],
  "secretConfig": {
    "host": "192.0.2.10",
    "port": 22,
    "username": "root",
    "credentialRef": "storage-production",
    "protocol": "env-v1",
    "allowedKeys": ["<MANAGED_ENV_KEYS 전체>"]
  },
  "deploymentConfig": { "protocol": "env-v1" }
}
```

target의 ID·표시명·설명·instance·location·정렬값과 실제 host/port는 설치 담당자가 결정한다.
비공개 connection metadata는 기존과 같이 API에 반환하지 않는다. `allowedKeys`만 관리 범위로 표시한다.
새 행 등록과 사용자별 대상 배정은 별개이며 기존 `secrets:*` 권한과 `user_key_management_targets`를 유지한다.
공개 소스에 개인 계정이나 실제 설치 행을 추가하지 않는다.

## 운영 연결 순서 (infra 담당자 소유)

현재 코드 검증만 승인된 상태다. 아래 항목은 운영 연결을 위한 검토안이며 이 변경으로 자동 실행되지 않는다.

1. GaDoc 도구 PR과 Control PR을 검토하고, main 배포 시점과 순서를 별도로 합의한다.
2. 새 guarded image/entrypoint를 먼저 검증한다. 미완료 journal은 앱만 보류하고 SSH·MongoDB가 살아 있어야 하며,
   기존 배포 handler와 `/usr/local/sbin/gadoc-kms-env` 두 정확한 forced command를 허용해야 한다.
   운영 이미지 빌드·교체·재시작은 현재 실행하지 않았으며 별도 infra 조율 대상이다.
3. root 소유 tools 디렉터리에 `env-management.mjs`, 검토된 `deploy-ubuntu.mjs`, 기존 `ssh-entrypoint.sh`,
   새 `env-ssh-entrypoint.sh`를 검토한 SHA로 함께 원자 설치한다. PM2 시작 전 guard가 먼저 적용되어 있어야 한다.
   전용 새 SSH 키를 provision한다. 기존 CI 키와 `slacord-ci` forced handler는 보존한다.
   `/usr/local/sbin/gadoc-kms-env`는 이미지에 들어 있다(`docker/gadoc/gadoc-kms-env.sh`, GaDoc 저장소
   `env-ssh-entrypoint.sh`와 같은 내용). 새 public key에만 `restrict,command="/usr/local/sbin/gadoc-kms-env"`를 지정한다.
   infra 담당자가 확인한 `/usr/local/bin/node`, `/usr/bin/flock`, `/usr/bin/timeout`,
   `/usr/local/bin/pm2`와 PM2 데이터 볼륨 `/root/.pm2`를 사용한다. 재설치 전에도 경로를 다시 확인한다.
   wrapper는 Node 실행 전 환경을 비우고 `SSH_ORIGINAL_COMMAND`만 값 그대로 전달한다.
   소유권·symlink·0600 검사를 만족하는 기존 파일을 확인하되 비밀값은 출력하지 않는다.
4. Control runtime의 `KEY_MANAGEMENT_SSH_IDENTITY_DIR`에 전용 `kscold-control-<credentialRef>` 키를
   0600으로 설치하고 실제 서버 host key를 기존 신뢰 저장소에 pin한다. runtime 키·mount 변경은 infra 담당자가 한다.
5. Control 스키마 migration과 코드 배포 후 설치별 target 행을 등록하고, 필요한 사용자에게만 기존 RBAC 방식으로 배정한다.
   기존 두 운영 대상의 행과 배정은 변경하지 않는다.
6. 비밀값을 로그에 남기지 않는 내부 API에서 연결·reveal 권한·암호화 백업·변경·UUID 상태·복원·재시도를 검증한다.
   실제 MINIO 키 회전·PM2 재시작 검증은 운영 담당자와 합의한 시간에 수행한다.

DNS, compose, launchd, Control 암호화 키, 기존 SSH 권한은 이 코드 변경의 자동 조작 대상이 아니다.
운영 target 미등록 또는 전용 키·도구 미설치 상태는 서비스 연결 완료로 취급하지 않는다.
