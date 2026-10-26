# 보안 정책 / Security Policy

## 제보 / Reporting

비밀번호, 토큰, 실제 환경 파일, 개인 접속 주소를 공개 이슈나 PR에 첨부하지 마세요.
GitHub의 [비공개 보안 제보](https://github.com/kscold/kscold-control/security/advisories/new)를 이용하세요.
Do not post credentials or deployment details in public issues. Use private vulnerability reporting.

## 운영 경계 / Deployment Boundary

- 공개 소스와 운영 데이터는 별개입니다. `.env`, Compose, 인증서와 Nginx 실제 설정은 로컬 전용입니다.
- 소스 저장소 업로드 기능은 사용자가 선택한 `.env`, 개인 키, 바이너리도 보존합니다.
  업로드 자료는 이 GitHub 저장소에 커밋되지 않습니다. 해당 프로젝트의 읽기 권한자는 다운로드할 수 있습니다.
- 키 관리 대상은 DB에 별도로 등록하고 접근 범위를 명시적으로 배정합니다.
  가입 승인만으로 특정 운영 대상 권한을 자동 부여하지 않습니다.
- Docker 소켓과 웹 터미널 권한은 호스트 관리자 권한에 준합니다. 신뢰한 사용자에게만 부여하세요.
- 실제 비밀값이 노출됐다면 이력 삭제와 별개로 폐기·교체해야 합니다.

Production configuration stays local. Uploaded project files may contain secrets and are accessible
to authorized project readers. Never expose terminal or Docker administration to untrusted users.
Rotate exposed credentials; deleting Git history alone cannot invalidate them.

## 이력 정리 이후 / After History Rewrites

이전 clone에서 단순 pull/merge 후 push하면 제거한 이력이 다시 공개될 수 있습니다.
로컬 작업과 비공개 설정을 별도로 보관한 뒤 새 clone을 사용하세요.
PR 캐시, 과거 SHA 링크, 다른 사람의 clone은 일반 push로 삭제되지 않습니다.
GitHub 캐시 정리는 [GitHub Support](https://support.github.com/)의 심사가 필요합니다.

Re-clone after a published history rewrite. Do not merge old history back into the repository.
Cached PR references require GitHub Support; other people's clones are outside our control.

## 검사 / Checks

`pnpm check:public-source`는 운영 파일 추적과 설치별 DB 시드를 막습니다.
`pnpm audit`는 의존성 취약점을 검사합니다. GitHub secret scanning과 push protection을 함께 사용하세요.
자동 검사 결과 0건은 알려지지 않은 취약점이나 모든 비밀값 부재를 보증하지 않습니다.
