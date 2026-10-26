# 운영 상태와 오류 진단 / Operational Diagnostics

## 네트워크 화면

- 외부 IP와 UPnP 매핑 목록은 독립적으로 조회합니다. 새로고침은 둘 다 다시 조회합니다.
- `확인 불가`는 조회 실패이며 `0개`와 다릅니다. 실패만으로 실제 서비스가 중단되었다고 판단하지 마세요.
- 재조회 실패 시 마지막 성공 시각과 이전 결과를 표시합니다. 매핑 상태가 확인되기 전까지 변경 버튼은 잠깁니다.
- `system:read`만 가진 사용자와 QA 미리보기 사용자는 변경 버튼을 볼 수 없습니다. API도 기존 권한 검사를 유지합니다.
- 정적 포트포워딩과 Docker 포트는 UPnP 목록에 포함되지 않습니다. 관리 페이지 주소를 임의로 추정하지 않습니다.
- 공유기 UPnP 설정, 서버의 네트워크 위치, VM·방화벽의 SSDP 통신을 확인하세요. 문제 해결을 위해 방화벽을 통째로 끄지 마세요.

서버는 탐색 실패를 `503 / UPNP_UNAVAILABLE`, 잘못되거나 불완전한 조회 응답을
`503 / UPNP_QUERY_FAILED`로 구분합니다. 정상 목록 끝은 UPnP 오류 코드 713입니다.
응답 크기(1 MiB), 요청 전체 시간(5초), 목록 개수(100개)를 제한합니다.
목록 조회는 25초 예산을 넘기면 다음 항목 요청을 중단합니다. 탐색·진행 중 요청은 별도 제한을 따릅니다.
한도를 넘긴 부분 결과를 완전한 목록으로 반환하지 않습니다. 브라우저는 45초 후 대기를 종료합니다.

## 브라우저 오류

로그인한 브라우저에서 렌더링 오류, 전역 오류, 처리되지 않은 Promise 거부,
스크립트·스타일시트 로드 실패, 업로드 오류 단계를 같은 Control 서버에 보고합니다.
로그의 `[FrontendError]` 항목에서 다음 필드를 확인할 수 있습니다.

| 필드                   | 기록 내용                                                        |
| ---------------------- | ---------------------------------------------------------------- |
| `kind`                 | `render`, `runtime`, `unhandled-rejection`, `resource`, `upload` |
| `route`                | 사전에 허용한 화면 경로 또는 `unknown`                           |
| `code`                 | 인증·권한·무결성·파일 접근·시간 초과·서버 오류 등 고정 분류      |
| `stage`, `batchIndex`  | 업로드 단계와 배치 번호. 파일명은 포함하지 않음                  |
| `httpStatus`           | 400~599 사이 HTTP 상태                                           |
| `release`, `errorType` | 프론트엔드 빌드 버전과 허용한 오류 유형                          |

오류 원문, 스택, 전체 URL·쿼리·해시, 프로젝트 이름, 소스 경로, 요청 본문,
토큰, `.env` 값은 진단 데이터에 포함하지 않습니다. 구형 클라이언트가 원문을 보내도
서버와 HTTP 요청 로그에서는 제외합니다. 일반 API 오류의 Axios 객체도 콘솔에 출력하지 않습니다.

동일 원인은 10초간 합치며 브라우저당 분당 20건, 서버에서는 사용자당 분당 20건으로
제한합니다. 전송 실패는 재귀적으로 수집하지 않고 로그인 상태를 바꾸지 않습니다.
이는 전체 오류를 빠짐없이 저장하는 감사 원장이 아닙니다. 로그인 전 오류, 다른 출처의
제한된 이벤트, 브라우저 종료·오프라인 상태, 한도 초과 오류는 기록되지 않을 수 있습니다.

## English

The network panel distinguishes an empty successful result from an unavailable
router. External IP and port mapping queries refresh independently. A failed refresh
keeps the last successful result visibly marked as stale and disables mapping changes.
Read-only users and impersonation previews do not receive mutation controls.
Static forwarding rules and Docker ports are not part of the UPnP inventory.

Authenticated browser diagnostics are sent only to the configured Control backend.
The server records allowlisted error categories, route names, upload stages, batch
indexes, HTTP status and frontend version. Raw messages, stack traces, URLs, paths,
request payloads and credentials are not collected. Older clients' raw error fields
are excluded from both diagnostic and HTTP request logs.

Collection is best-effort and rate-limited, not a complete audit trail. Failed reports
do not log the user out or trigger recursive reports. Search `[FrontendError]` in
the application process logs. Package versions and the latest changelog entry are
checked by `pnpm check:version` before deployment.

## References

- [UPnP WANIPConnection service specification](https://upnp.org/specs/gw/UPnP-gw-WANIPConnection-v1-Service.pdf)
- [MDN: error event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event)
- [MDN: unhandledrejection event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event)
