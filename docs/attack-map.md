# 공격 지도

접속 보안 화면의 "공격 지도" 탭은 맥미니를 두드리는 외부 IP 를 세계 지도에 찍고 나라별로 순위를 매긴다. SSH 접속 탭의 IP 요약과 차단 목록, 사이트 IP 차단 탭의 방화벽 차단 목록에도 IP 옆에 국기와 도시를 붙인다.

## 무엇을 세는가

- SSH: 접속 기록(`SSH_AUDIT_DIR` 의 `ssh-audit.log`)의 실패·없는 계정·시도 초과와 성공.
- 웹 로그인: Control 로그인 기록(`login_attempts`)의 실패와 거절. 30일 뒤 지워지므로 30일까지만 본다.
- 내 IP 목록, 맥미니 자신, 내부망, Tailscale 주소는 공격이 아니므로 뺀다.
- "차단 중"은 SSH 차단기 방화벽 목록이나 nginx 차단(활성)에 들어 있는 IP 다. 대역 차단에 걸린 IP 도 차단 중으로 본다.

API 는 `GET /api/security/attack-map?days=1|7|30` 이고 `security:read` 권한이 필요하다. IP 별 점(`points`)과 나라별 묶음(`countries`)을 돌려준다. 위치를 못 찾은 IP 는 `country: null` 묶음으로 순위 맨 끝에 둔다.

## IP 위치 파일

IP 는 맥 안의 파일에서만 찾고 외부 API 로 보내지 않는다. 파일은 [DB-IP](https://db-ip.com) 의 IP to City Lite(CC BY 4.0)를 쓴다. 화면에는 `IP Geolocation by DB-IP` 링크를 늘 표시한다.

```sh
node scripts/fetch-ip-geo-db.mjs --out /absolute/path/dbip-city-lite.mmdb
```

- 받은 뒤 `.env` 의 `CONTROL_IP_GEO_DB_PATH` 에 그 절대 경로를 넣고 Control 을 다시 시작한다.
- 비워 두면 지도가 꺼지고 탭에 설정 방법이 나온다. 파일이 없거나 깨져도 Control 기동과 다른 화면은 그대로 동작한다.
- 파일은 약 130MB 이고 기동 때 통째로 메모리에 올린다. 그만큼 백엔드 메모리가 는다.
- DB-IP Lite 는 매달 새 판이 나온다. 같은 명령으로 바꾸고 다시 시작하면 새 판을 쓴다. 받기가 실패하면 기존 파일이 그대로 남는다.

## 허용 국가 밖 SSH 차단

같은 IP 위치 파일로 SSH 접속 IP 의 나라를 보고, 허용 국가 밖이면 실패 횟수를 기다리지 않고 바로 맥미니 방화벽 차단 목록(`ssh-block-manual.txt`)에 올린다. 계정과 성공 여부는 따지지 않는다.

- 접속만 한 IP(성공·인증 중 끊김)는 SSH 만 막고 사이트는 열어 둔다. 비밀번호 실패·없는 계정·root 시도·시도 초과가 보이면 SSH·사이트 모두 막는다. SSH 만 막아 둔 IP 가 나중에 공격하면 모두 막도록 넓힌다.
- 이유 칸은 `허용 국가 밖 SSH 접속 (US, user=…)` 또는 `허용 국가 밖 SSH 공격 (…)` 이다. 화면은 이 이유로 이 규칙이 올린 차단을 나라별로 센다.
- 허용 국가 밖에서 로그인이 성공하면 `ssh.country-intrusion` 감사 기록을 남긴다. 열린 세션은 끊지 않는다. 위치 파일이 틀려 운영자 자신이 걸렸을 때 그 세션이 남은 복구 수단이기 때문이다. 침입이면 SSH 탭에서 끊는다.
- 내 IP 목록, `SECURITY_ALLOWLIST`, 내부망·Tailscale, 위치를 모르는 IP 는 나라로 막지 않는다. 위치를 모르는 IP 는 기존 실패 횟수 규칙(차단기)에 맡긴다.
- 다른 규칙이나 운영자가 이미 막은 IP 는 범위를 바꾸지 않는다.
- 30초마다 기록 파일에 새로 붙은 줄만 읽는다. Control 이 뜬 뒤 처음 돌 때와 설정을 바꾼 뒤에는 최근 7일을 다시 본다. 그래서 풀어 준 IP 도 그 나라가 여전히 허용 밖이면 다시 막힐 수 있다. 계속 허용하려면 내 IP 로 표시한다.
- 설정은 SSH 접속 탭에서 바꾸고 `SSH_AUDIT_DIR` 의 `ssh-country-guard.json` 에 저장한다. 파일이 없으면 한국(`KR`)만 허용하고 켠다. 위치 파일이 준비되지 않으면 쉰다.
- 나라를 다시 허용해도 이미 올린 차단은 풀지 않는다. 화면의 "이 나라 차단 모두 해제"로 이 규칙이 그 나라에 올린 차단만 푼다.

API: 설정과 나라별 차단 수는 `GET /api/security/ssh` 의 `countryGuard`, 바꾸기는 `PATCH /api/security/ssh/country-guard`(`enabled`, `allowedCountries`), 나라별 해제는 `POST /api/security/ssh/country-guard/countries/:country/unblock` 이다. 바꾸기는 `security:manage` 권한과 감사 기록이 따른다.

## 지도 자료

세계 지도는 [Natural Earth](https://www.naturalearthdata.com) 1:110m 국가 경계(공개 도메인, v5.1.2)를 단순화한 것이다. 원본은 저장소에 넣지 않는다. 다시 만들 때는 아래 명령을 쓴다. 고정한 태그에서 받고 SHA-256 으로 같은 파일인지 확인한다.

```sh
node scripts/build-world-map.mjs
```

결과는 `apps/frontend/src/features/security/lib/worldMap.generated.ts` 이고 손으로 고치지 않는다. 지도 탭을 열 때만 내려받는다.
