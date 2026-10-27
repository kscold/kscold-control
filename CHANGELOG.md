# Changelog

## Unreleased

- 블로그 API·웹·Agent·MongoDB·Qdrant를 고정 버전의 ARM64 이미지와 Supervisor로 구성함.
- 기존 포트·CPU 우선순위와 원본 데이터를 보존하는 별도 Compose 및 교체·검증 절차를 추가함.
- 다음 이미지 빌드부터 백엔드 파일 로그 디렉터리를 UID 10001 소유로 생성하도록 보완함.

## 1.4.2 - 2026-10-27

- 토폴로지 컨테이너 제목을 실제 이름으로 통일하고 기존 친근한 이름을 부제로 보존함.
- PM2가 없는 컨테이너의 Supervisor 프로그램 상태·PID·가동시간을 표시함.
- 통합 블로그 이미지의 API·웹·Agent·MongoDB·Qdrant 서비스 포트를 감지함.
- 별도 Agent·Qdrant 컨테이너가 사라진 경우의 연결과 기존 PM2 표시를 회귀 검증함.

## 1.4.1 - 2026-10-26

- 네트워크 조회 실패를 빈 목록으로 처리하던 오류를 수정하고 상태·이전 결과·재시도 안내를 분리함.
- UPnP 탐색을 합치고 소켓·타이머를 정리하여 반복 조회 시 자원 누수를 방지함.
- 모바일 포트 목록을 개선하고 읽기 전용·QA 미리보기의 변경 버튼을 제거함.
- 렌더링·전역·비동기·번들 오류 및 업로드 실패 단계를 민감정보 없는 진단으로 기록함.
- 구형 오류 요청의 원문도 HTTP 로그에서 제외하고 사용자별 수집량을 제한함.
- 루트·프론트·백엔드 버전과 변경 이력을 CI 및 배포 전에 검증함.

Network failures now return an explicit unavailable state instead of an empty
success. Browser diagnostics send only allowlisted categories and release context,
not messages, stacks, source paths, URLs, credentials or environment contents.
No DB migration or router configuration change is required.
Cross-platform one-command installers remain a separate, unfinished task.

## 1.4.0 - 2026-10-26

- 공개 예시와 DB 마이그레이션에서 설치별 프로젝트·계정·접속 정보를 제거함.
- 운영 Compose, SSL, 환경 파일을 공개 소스와 분리하고 CI 경계 검사를 추가함.
- 개인 서버 경로 대신 환경 변수와 OS 기본 경로를 사용함.
- 기존 마이그레이션 적용 기록과 데이터가 유지되도록 제한된 체크섬 호환 검사를 추가함.
- 승인된 키 관리자에게 운영 대상을 자동 배정하지 않도록 수정함.
- 알려진 취약 의존성을 갱신하고 CI에 전체 심각도 보안 검사를 추가함.
- MIT LICENSE 및 비공개 보안 제보 안내를 추가함. CI 런타임을 Node.js 24 LTS로 갱신함.

### Upgrade Notes

운영 설정은 Git에서 제거되었으므로 업그레이드 전에 별도로 보존해야 합니다.
기존 `.env`, DB, 업로드 자료, 인증서는 삭제하거나 다시 생성하지 않습니다.
배포 확인에는 자신의 `FRONTEND_URL`을 사용합니다. Compose 경로는
`CONTROL_COMPOSE_FILE` 또는 비공개 `docker-compose.local.yml`로 설정합니다.
기존 `docker-compose.yml`도 지원합니다.

Preserve private deployment configuration before upgrading. Existing DB records,
credentials, uploaded sources and certificates must not be recreated.
After a history rewrite, use a fresh clone rather than merging old history.
Cross-platform automated installers and broader browser error collection are
separate work in progress, not delivered by this release.
