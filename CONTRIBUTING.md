# Contributing to kscold-control

First off, thank you for taking the time to contribute! 🙌

> 주석·변경 이력·이슈·PR은 한국어를 기본으로 작성합니다. 공개 API 이름과 기술 식별자는 기존 영어 표기를 유지합니다.
> 커밋 제목은 Conventional Commits 형식에 한국어 음슴체를 사용합니다. 예: `fix(security): 이전 조회 응답이 최신 결과를 덮지 않도록 수정함`.

---

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Branch & commit conventions](#branch--commit-conventions)
- [Pull request process](#pull-request-process)
- [Architecture guidelines](#architecture-guidelines)
- [Automation](#automation)

---

## Code of conduct

Be respectful and constructive. We want this to be a welcoming project for contributors of all experience levels.

## Ways to contribute

- 🐛 **Report bugs** — open a [bug report](https://github.com/kscold/kscold-control/issues/new?template=bug_report.yml)
- ✨ **Request features** — open a [feature request](https://github.com/kscold/kscold-control/issues/new?template=feature_request.yml)
- 📝 **Improve docs** — fix typos, clarify setup steps, add examples
- 🔧 **Fix issues** — look for [`good first issue`](https://github.com/kscold/kscold-control/labels/good%20first%20issue) or [`help wanted`](https://github.com/kscold/kscold-control/labels/help%20wanted)

## Development setup

```bash
git clone https://github.com/kscold/kscold-control.git
cd kscold-control
pnpm install          # install all workspace dependencies
cp .env.example .env  # fill in DATABASE_URL and JWT_SECRET at minimum
pnpm dev              # backend :4000 + frontend :3000
```

See the [README](README.md) for full prerequisites and AI provider setup.

Before pushing:

```bash
pnpm build   # must pass
pnpm lint    # should pass
```

프론트엔드 타입 검사는 존재하지 않는 `tsconfig.app.json` 대신 아래 명령으로 수행합니다.

```bash
pnpm --filter @kscold-control/frontend exec tsc --noEmit -p tsconfig.json
pnpm check:architecture
pnpm check:runtime-contracts
pnpm check:version
```

동작이 바뀌면 성공·실패·취소 경로를 테스트합니다. 비동기 조회는 이전 응답이 새 상태를 덮지 않게 하고, 화면 이탈 시 요청과 타이머를 정리합니다. 공유 파일을 읽고 수정할 때는 동시 쓰기 충돌을 검증합니다. 운영 로그와 실제 접속 정보는 테스트 예시에 복사하지 않습니다.

## Branch & commit conventions

Create a topic branch off `main`:

```bash
git checkout -b feat/your-feature      # or fix/, refactor/, docs/, chore/
```

커밋과 PR 제목은 범위를 포함한 **[Conventional Commits](https://www.conventionalcommits.org/)** 형식을 사용합니다. 자동 CI 대신 검토자가 제목과 로컬 검증 결과를 확인합니다.

```
feat(frontend): add OpenAI provider toggle
fix(backend): prevent unhandled rejection in chat gateway
refactor(frontend): move formatBytes to shared layer
docs: clarify SSL renewal steps
chore(deps): bump openai to 6.1.0
```

Common scopes: `frontend`, `backend`, `infra`, `ci`, `deps`.

## Pull request process

1. **Open or link an issue** describing the change.
2. Push your branch and open a PR against `main`. The [PR template](.github/PULL_REQUEST_TEMPLATE.md) fills in automatically.
3. `pnpm lint`, `pnpm test:backend`, `pnpm test:frontend`, `pnpm build`를 로컬에서 실행하고 결과를 PR에 기록합니다.
4. A maintainer reviews; address feedback by pushing new commits.
5. Once approved, the PR is **squash-merged** and the branch is deleted.

> 자동 PR 제목 검사는 실행하지 않지만 제목 형식은 유지합니다.

## Architecture guidelines

- **Backend** follows **Clean Architecture**: `domain → application → presentation`. Keep business logic out of controllers/gateways.
- **Frontend** follows **Feature-Sliced Design (FSD)**:
  - Import direction is one-way: `app → pages → widgets → features → entities → shared`.
  - **Never** import upward (e.g. `shared` must not import from `features`).
  - **Never** import sideways between slices (e.g. `features/docker` must not import from `features/dashboard`). Put shared code in `shared/`.
  - Import slices through their public API (`index.ts`), not internal files.

## Automation

반복 실행과 알림을 줄이기 위해 저장소의 GitHub Actions를 비활성화했습니다.
워크플로 파일은 이력과 복구를 위해 보존하지만 자동 실행하지 않습니다.
Dependabot 정기 버전 업데이트 PR도 중지했습니다. 보안 경고와 배포 전 로컬 검증은 유지합니다.

Thanks again for contributing! ✨
