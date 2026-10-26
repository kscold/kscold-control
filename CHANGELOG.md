# Changelog

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
