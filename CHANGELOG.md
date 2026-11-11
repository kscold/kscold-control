# Changelog

## Unreleased

## 1.6.0 - 2026-11-11

보안 1단계: 인터넷에 열린 콘솔을 비밀번호 하나로는 뚫지 못하게 함.

- 로그인마다 서버 세션(auth_sessions)을 두고 토큰에 sid 를 넣음. 로그아웃·비밀번호 변경·관리자 조치로 세션을 끊으면 열린 터미널·AI 채팅·로그 스트림·원격 데스크톱 연결도 바로 닫힘. 갱신은 30일 절대 만료를 넘지 않음 (#167).
- 백엔드는 기본으로 루프백에만 열고, X-Real-IP 는 신뢰 프록시가 CONTROL_PROXY_SECRET 과 함께 보낸 요청만 믿음 (#167).
- 웹 터미널과 Claude·Codex 에이전트에 허용 목록 환경 변수만 넘겨 JWT_SECRET·DATABASE_URL 등 백엔드 비밀값이 새지 않게 함 (#168).
- 반복된 로그인 실패를 막음. IP 15분 5회 실패 시 nginx 1시간 차단, 하루 20회 시 호스트 방화벽 차단, 계정은 출처별 15분 10회 실패 시 잠금. 병렬 요청 우회 방지, nginx 재적용 묶음, 호스트 전용 잠금 해제 스크립트. 공개 가입은 기본으로 끔 (#169).
- 관리자 OTP 2차 인증과 1회용 복구 코드 10개. 비밀값은 AES-256-GCM 으로 암호화, 틀린 코드도 로그인 실패 차단에 함께 셈, 호스트 전용 비상 해제 스크립트 (#170, #171).
- 맥미니 SSH 접속 화면: 차단 범위(SSH 만 / SSH·사이트) 선택, 내 IP 별칭, 사이트 IP 차단 탭과 같은 방화벽 차단 목록, 목록 쪽 나누기 (#160~#166).

### 배포 시 필요한 설정

- `CONTROL_PROXY_SECRET`(32자 이상)과 nginx 의 `X-Control-Proxy-Secret` 헤더.
- `CONTROL_MFA_ENCRYPTION_KEY`(32바이트 base64, 한 번 정하면 바꾸지 않음), `CONTROL_MFA_REQUIRED_ROLES`.
- 배포하면 기존 로그인은 모두 한 번 풀리고, 대상 관리자는 다음 로그인에서 OTP 를 등록함.

## 1.5.0 - 2026-11-11

- 단일 Control 프로세스의 SSH 목록 변경을 직렬화해 동시 요청으로 인한 파일 덮어쓰기와 중복 등록을 방지함.
- SSH 조회 기간 변경·화면 이탈 시 이전 요청을 취소하고, 오래된 응답이 새 결과를 덮지 않도록 수정함.
- 새로고침 실패와 이전 데이터 표시를 구분하고 수동 차단에도 영향 범위 확인을 추가함.
- SSH 세션 조회 명령에 실행 시간 제한을 적용함. 실제 방화벽 적용과 차단 요청 목록을 구분해 안내함.
- SSH 접속 기록·열린 세션·차단 목록 관리와 원격 데스크톱 개선을 정식 릴리스로 묶음.

- 원격 연결의 무응답 감지·종료 처리를 통합해 TCP·WebSocket·타이머를 정리하고, 페이지 이탈 및 연결 요청 취소를 처리함.
- 원격 데스크톱을 화면 중심 도구 모음·인증 카드·겹침 패널로 재설계함. 설치별 기본 사용자 이름과 선택 대상 재연결을 지원함.
- 원격 화면의 대상 목록·도구·클립보드를 접고 화면 전체를 사용할 수 있게 함. 원격 데스크톱 메뉴를 대시보드 아래로 옮김.
- 기본 맥미니와 추가 원격 대상을 등록하고, 대상별 계정·암호를 암호화 저장해 선택 시 자동 인증하도록 함.
- 관리자 전용 브라우저 원격 데스크톱과 텍스트 클립보드를 추가함. 일회용 연결권, Origin 검사, 권한 재확인과 연결 시간 제한을 적용함.
- 운영 키 화면에 SSH 키 보관함을 추가해 개인 키를 암호화해 저장하고 전체 관리자가 내려받을 수 있게 함.
- 백업 대상에 접속 컨테이너를 지정해, 포트를 공개하지 않은 컨테이너의 MongoDB도 일회용 mongodump로 백업할 수 있게 함.
- 실제 접속 주소 전환에 맞춰 보안 화면의 "차단이 동작하지 않음" 경고를 없애고, 본인 IP 차단 방지 판단이 nginx의 X-Real-IP를 쓰도록 함.
- Nginx 사이트 설정에 PROXY protocol 리스너(8080/8443)와 실제 접속 주소(realip) 설정을 추가하고, 사이트 생성기도 같은 리스너를 쓰도록 함.
- Nginx access 로그 끝에 실제 접속 주소(client) 필드를 추가함.
- 블로그 API·웹·Agent·MongoDB·Qdrant를 고정 버전의 ARM64 이미지와 Supervisor로 구성함.
- 기존 포트·CPU 우선순위와 원본 데이터를 보존하는 별도 Compose 및 교체·검증 절차를 추가함.
- 다음 이미지 빌드부터 백엔드 파일 로그 디렉터리를 UID 10001 소유로 생성하도록 보완함.
- 모바일 터미널을 화면 폭에 맞춰 가로 스크롤을 없애고, 출력 전체를 평문으로 띄워 복사할 수 있게 함.

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
