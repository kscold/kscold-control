# Contributing to kscold-control

First off, thank you for taking the time to contribute! 🙌

> **Language:** English is preferred for issues, pull requests, and commit messages so the project stays accessible to everyone. **Korean is welcome too** — write in whichever language lets you express the problem most clearly.
> 이슈·PR·커밋 메시지는 **영어 작성을 권장**하지만, **한국어도 괜찮습니다**. 더 명확하게 표현할 수 있는 언어를 사용하세요.

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

## Branch & commit conventions

Create a topic branch off `main`:

```bash
git checkout -b feat/your-feature      # or fix/, refactor/, docs/, chore/
```

We use **[Conventional Commits](https://www.conventionalcommits.org/)** with a scope. The PR title is validated automatically by CI.

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
3. Make sure **CI passes** (build + PR title lint).
4. A maintainer reviews; address feedback by pushing new commits.
5. Once approved, the PR is **squash-merged** and the branch is deleted.

> PRs that don't follow the Conventional Commit title format will fail the `PR Title Lint` check.

## Architecture guidelines

- **Backend** follows **Clean Architecture**: `domain → application → presentation`. Keep business logic out of controllers/gateways.
- **Frontend** follows **Feature-Sliced Design (FSD)**:
  - Import direction is one-way: `app → pages → widgets → features → entities → shared`.
  - **Never** import upward (e.g. `shared` must not import from `features`).
  - **Never** import sideways between slices (e.g. `features/docker` must not import from `features/dashboard`). Put shared code in `shared/`.
  - Import slices through their public API (`index.ts`), not internal files.

## Automation

This repo runs several GitHub Actions on every PR:

| Workflow | What it does |
|---|---|
| **CI** | Installs deps, lints, and builds the monorepo |
| **PR Title Lint** | Enforces Conventional Commit PR titles |
| **PR Labeler** | Auto-labels PRs by changed paths (`frontend`, `backend`, `ci`, …) |
| **Greetings** | Welcomes first-time contributors |
| **Dependabot** | Weekly grouped dependency update PRs |

Thanks again for contributing! ✨
