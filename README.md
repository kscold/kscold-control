# kscold-control

A self-hosted infrastructure governance panel for managing Docker containers, Nginx, SSL certificates, AI coding assistants (Claude Code · OpenAI Chat API · Codex CLI), source repositories, and system monitoring — all from a single web interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24_LTS-green)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io)
[![NestJS](https://img.shields.io/badge/NestJS-11-red)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev)
[![Release](https://img.shields.io/github/v/release/kscold/kscold-control)](https://github.com/kscold/kscold-control/releases)

운영 설정과 공개 소스는 분리합니다. 개인 프로젝트·계정·도메인은 예시에 넣지 않으며,
실제 대상과 권한은 각 설치의 DB 및 비공개 설정에서 관리합니다. [보안 정책 / Security](SECURITY.md)

네트워크 상태·재시도·민감정보 없는 오류 수집 안내:
[운영 진단 / Operational Diagnostics](docs/operations-diagnostics.md)

---

## Features

| Category        | Capabilities                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------- |
| **AI Terminal** | Claude Code workspace · Claude Chat · OpenAI Chat API (GPT-4o) · OpenAI Codex CLI — multi-tab |
| **Docker**      | Container lifecycle, real-time log streaming, archive log viewer                              |
| **Nginx**       | Virtual host management, SSL issuance & renewal (Let's Encrypt)                               |
| **Repository**  | Resumable SHA-256 uploads, atomic publish, version snapshots, diff viewer, file browser       |
| **Audit**       | AOP-based automatic audit log, CSV export, actor/target insights                              |
| **Security**    | IP ban management, JWT RBAC, permission guards                                                |
| **Key Vault**   | DB-driven targets, encrypted `.env` backups, GCP/SSH versioned deploys                        |
| **Logs**        | Unified viewer — backend · PM2 · Nginx · Docker · blog container logs                         |
| **Network**     | Topology graph (React Flow), UPnP port management                                             |
| **Maintenance** | Daily cleanup of finished git worktrees with local-file backup and run history                |
| **Backups**     | DB-managed MongoDB backup targets, per-target daily schedule, retention pruning, run history  |
| **System**      | Real-time CPU / memory / disk, Nginx status, host info                                        |

---

## Architecture

```
kscold-control/
├── apps/
│   ├── backend/              # NestJS (Clean Architecture)
│   │   └── src/
│   │       ├── auth/             # JWT authentication & RBAC
│   │       ├── claude-chat/      # Claude Code & Chat WebSocket gateway
│   │       ├── openai-chat/      # OpenAI Chat API & Codex CLI gateway
│   │       ├── terminal/         # PTY sessions (node-pty + Socket.io)
│   │       ├── docker/           # Dockerode integration
│   │       ├── nginx/            # Nginx config & SSL (certbot)
│   │       ├── logs/             # Unified log reader
│   │       ├── repository/       # Source version management
│   │       ├── audit/            # AOP audit interceptor
│   │       ├── key-management/   # Multi-target secret stores, encrypted backups, deployment
│   │       ├── backup/           # Backup targets, scheduler, run history
│   │       └── security/         # IP ban
│   └── frontend/             # React 18 + Vite + Tailwind CSS
│       └── src/
│           ├── features/         # Feature-Sliced Design (FSD)
│           │   ├── claude-chat/
│           │   ├── openai-chat/
│           │   ├── terminal/
│           │   ├── docker/
│           │   └── ...
│           ├── widgets/          # Compositions of multiple features
│           └── pages/            # One slice per route
├── nginx/                    # Nginx config templates
├── scripts/                  # Utility shell scripts
└── .env.example              # Environment variable reference
```

**Backend** — Domain → Application → Presentation (Clean Architecture)  
**Frontend** — Feature-Sliced Design (FSD): entities / features / widgets / pages  
**Realtime** — Socket.io namespaces: `/terminal` · `/claude-chat` · `/openai-chat`  
**Package manager** — pnpm workspaces + Turborepo

---

## Quick Start

### Prerequisites

| Tool       | Min version   |
| ---------- | ------------- |
| Node.js    | 24 LTS        |
| pnpm       | 10.29.3       |
| PostgreSQL | 14            |
| Docker     | 24 (optional) |

### Manual development setup

원클릭 설치는 아직 검증 중입니다. 아래는 PostgreSQL과 개발 도구가 준비된 환경의 수동 절차입니다.
Automated cross-platform installation is still being validated; the steps below are manual.

```bash
git clone https://github.com/kscold/kscold-control.git
cd kscold-control
pnpm install          # install all workspace dependencies
cp .env.example .env  # fill in DATABASE_URL and JWT_SECRET at minimum
pnpm dev              # starts backend :4000 + frontend :3000 in parallel
```

Open [http://localhost:3000](http://localhost:3000).

### Seed admin account

```bash
# 초기 데이터(권한·역할·관리자 계정)는 서버 기동 시 자동으로 시딩된다
```

---

## AI Provider Setup

### Claude Code / Claude Chat

Install the official CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

Authenticate once (`claude login`) or set `ANTHROPIC_API_KEY` in your environment.  
Set `CLAUDE_WORKING_DIR` in `.env` to point to your project root.

### OpenAI Chat API (GPT-4o)

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o    # optional, default: gpt-4o
```

### OpenAI Codex CLI

```bash
npm install -g @openai/codex
```

`OPENAI_API_KEY` is shared with the Chat API. Optionally set `CODEX_BIN` to override the binary path.

---

## Environment Variables

| Variable                          | Default                    | Description                               |
| --------------------------------- | -------------------------- | ----------------------------------------- |
| `DATABASE_URL`                    | —                          | PostgreSQL connection string (required)   |
| `JWT_SECRET`                      | —                          | JWT signing secret (required)             |
| `PORT`                            | `4000`                     | Backend HTTP/WS port                      |
| `FRONTEND_URL`                    | `http://localhost:3000`    | CORS allowed origin                       |
| `CONTROL_FRONTEND_DIST_PATH`      | built-in `frontend/dist`   | Atomically published production UI path   |
| `NODE_ENV`                        | `development`              | `production` disables TypeORM auto-sync   |
| `CLAUDE_WORKING_DIR`              | `$HOME`                    | Working directory for AI coding sessions  |
| `OPENAI_API_KEY`                  | —                          | OpenAI API key (Chat API + Codex CLI)     |
| `OPENAI_MODEL`                    | `gpt-4o`                   | OpenAI model for Chat API                 |
| `CODEX_BIN`                       | `codex`                    | Path to Codex binary                      |
| `LOG_LEVEL`                       | `info`                     | Winston log level                         |
| `KEY_MANAGEMENT_ENCRYPTION_KEY`   | —                          | Base64 32-byte AES-GCM key for DB secrets |
| `KEY_MANAGEMENT_GCLOUD_PATH`      | `/opt/homebrew/bin/gcloud` | Path to the Google Cloud CLI              |
| `KEY_MANAGEMENT_GH_PATH`          | `/opt/homebrew/bin/gh`     | Path to the GitHub CLI                    |
| `KEY_MANAGEMENT_SSH_PATH`         | `/usr/bin/ssh`             | Path to the OpenSSH client                |
| `KEY_MANAGEMENT_SSH_IDENTITY_DIR` | `$HOME/.ssh`               | Directory containing target SSH keys      |

## Multi-target Key Management API

Public registration creates a `pending_approval` account with no permissions.
An administrator approves it from **RBAC → Users → 대시보드 + 운영 키 관리자 승인**. The
approved `key_manager` role receives only `dashboard:read`, `secrets:read`,
`secrets:reveal`, `secrets:write`, and `secrets:deploy`.
Target scope is stored separately in `user_key_management_targets`. Global
administrators always see every enabled target; other key managers only see and
operate the targets selected on their RBAC user card. New approvals start with
no target access. An administrator must explicitly assign the allowed targets.

### Read-only user preview

Legacy `admin` and `super_admin` users can select **QA 화면 보기** on a
non-admin user card to inspect the application with that user's current roles.
The preview token expires after 15 minutes. A persistent banner returns to the
original administrator immediately; mutating HTTP requests and all Terminal,
Claude, and Codex WebSocket sessions are rejected server-side during preview.
Each preview start is recorded in the RBAC audit timeline.

Targets are registered in `key_management_targets` for each installation. Public
migrations define structure only; they do not create operator accounts, grant
target access or register production endpoints. Get a JWT and the
current version for the targets granted to that user:

```bash
TOKEN="$(curl -fsS https://control.example.com/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"email":"developer@example.com","password":"your-password"}' \
  | jq -r '.accessToken')"

curl -fsS https://control.example.com/api/key-management/targets \
  -H "Authorization: Bearer $TOKEN"
```

Change one key. `secretValue` is the literal text after `=` in the `.env` file.
Use the version returned by the previous request; stale versions return HTTP 409.
GCP versions are numeric, while SSH env versions are full SHA-256 checksums.

```bash
curl -fsS -X PATCH \
  https://control.example.com/api/key-management/targets/projectalpha-production/environment/MY_KEY \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"secretValue":"new-value","expectedVersion":"1"}'
```

Replace the complete `.env` without putting its content in command arguments:

```bash
jq -n --rawfile env .env --arg version '1' \
  '{envFile: $env, expectedVersion: $version}' | \
curl -fsS -X PUT \
  https://control.example.com/api/key-management/targets/projectalpha-production/environment \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' --data-binary @-
```

Every PATCH, PUT, and restore first stores the current environment in PostgreSQL
as AES-256-GCM ciphertext. A failed backup aborts the operation before touching
the target. Changes use optimistic version checks, and a second change is blocked
while the previous deployment is active. ProjectAlpha dispatches the exact Secret Manager
version to GitHub Actions. ProjectBeta atomically replaces `.env.production` over SSH,
then runs its existing blue/green readiness and Nginx rollback flow.

For SSH targets, put a passwordless private key at
`$KEY_MANAGEMENT_SSH_IDENTITY_DIR/kscold-control-<credentialRef>`, set mode `0600`,
install its public key in the target account, and pin the host in `known_hosts`.
Passwords and private key contents must never be stored in the target table.

```bash
# Deployment and encrypted-backup ledger
curl -fsS \
  https://control.example.com/api/key-management/targets/projectalpha-production/backups \
  -H "Authorization: Bearer $TOKEN"

# Restore still creates a new pre-change backup and immutable secret version
curl -fsS -X POST \
  https://control.example.com/api/key-management/targets/projectalpha-production/backups/BACKUP_ID/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"expectedVersion":"2"}'
```

---

## Backup Management

Dump MongoDB databases that live outside the host (for example MongoDB Atlas)
once a day and delete backups that have outlived their retention period.
Targets are stored in PostgreSQL and managed on the **백업 관리** page
(`/backups`) — no redeploy is needed to add a target or change its schedule.

| Setting        | Default   | Description                                                       |
| -------------- | --------- | ----------------------------------------------------------------- |
| Name           | —         | Identifier and backup directory name; fixed after creation        |
| Connection URI | —         | Only the database in the URI path is dumped; use a read-only user |
| Daily run time | `03:30`   | `HH:mm` in Asia/Seoul, per target                                 |
| Retention days | `10`      | Backups older than this are deleted after a successful run        |
| Dump image     | `mongo:7` | Docker image that provides `mongodump`                            |
| Enabled        | on        | Pauses the schedule; manual runs still work                       |

- **Credentials** — the connection URI is stored as AES-256-GCM ciphertext
  (`KEY_MANAGEMENT_ENCRYPTION_KEY`) and is never returned by the API or shown
  again; the page displays only the host and database. It reaches `mongodump`
  through the environment and a config file inside a throwaway container, never
  as a command-line argument.
- **Schedule** — a one-minute scheduler runs every target whose daily time has
  passed since its last scheduled run, so a backup missed while the server was
  down still runs once it is back. Targets are dumped one at a time.
- **Archives** — written to
  `~/Desktop/server-logs/mongodb-backups/<name>/<UTC timestamp>/dump.archive.gz`
  with owner-only permissions. Old backups are pruned only after a new backup
  succeeds, and the most recent backup is always kept, so a failing target never
  loses its last good copy. Deleting a target removes its settings and history
  but leaves the archives on disk.
- **History** — every run (scheduled or manual, with who started it) is recorded
  and shown on the page. Changes and manual runs are also written to the audit
  log under the `backup` domain.
- **Permissions** — `backup:manage` (administrators) can change targets, run a
  backup, and see every target. `backup:read` alone only opens the page: such a
  user sees just the targets an administrator assigned to them under
  **권한 관리 → 백업 열람 범위**, so a collaborator can watch one project's
  backups without seeing the others.
- **Databases on the same host** — the dump runs in its own container, where
  `localhost` is that container, not the server. For a MongoDB running in
  another container on this host, publish its port and use
  `host.docker.internal:<port>` as the host; loopback addresses are rejected
  when a target is saved.

```bash
# Targets with schedule, last result, and stored backups
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/backups/targets

# Register a target
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"my-app-prod","uri":"mongodb://database.example.com:27017/app","scheduleTime":"03:30","retentionDays":10}' \
  http://localhost:4000/api/backups/targets

# Start a backup now — returns 202 with the run; poll the history for the result
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/backups/targets/TARGET_ID/run

# Run history (optionally ?targetId=TARGET_ID&limit=30)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/backups/runs

# Let a backup:read user see specific targets (requires rbac:manage)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"targetIds":["TARGET_ID"]}' \
  http://localhost:4000/api/rbac/users/USER_ID/backup-target-access

# Restore an archive (add --nsFrom/--nsTo to restore into another database)
docker run --rm -i -e MONGODB_URI mongo:7 \
  sh -c 'mongorestore --uri "$MONGODB_URI" --archive --gzip' < dump.archive.gz
```

---

## Worktree Cleanup

Long-running agent work leaves many `git worktree` checkouts behind (each with its
own `node_modules` and build output). The **작업 폴더 정리** page (`/maintenance`)
removes the ones that can be recreated from the remote, once a day.

| Setting       | Default                                  | Description                                          |
| ------------- | ---------------------------------------- | ---------------------------------------------------- |
| Root path     | —                                        | Directory whose direct children are linked worktrees |
| Keep recent   | `3`                                      | Most recently touched worktrees are always kept      |
| Keep unmerged | on                                       | Keep worktrees whose HEAD is not in a base branch    |
| Base branches | `origin/dev, origin/main, origin/master` | What counts as merged                                |
| Daily time    | `04:30`                                  | `HH:mm` Asia/Seoul                                   |

- A worktree is **always kept** when a process is running inside it, it has
  uncommitted changes, or it has commits that exist on no remote. Anything the
  scan cannot read is kept too.
- Removal uses `git worktree remove`; the main repository and the branch stay.
  Right before removing, the state is checked again. Ignored local files such as
  `.env` (not dependency or build directories) and a `manifest.json` with the
  restore command are written to
  `~/Desktop/server-logs/worktree-cleanup/<target>/<timestamp>/<worktree>/`.
- Each run records both the summed folder size and the free space the disk
  actually gained. They differ when worktrees share blocks — pnpm installs
  `node_modules` as APFS clones on macOS, so removing one clone frees little.
- **미리보기** shows what would be removed without touching anything. Viewing
  needs `system:read`; changing targets and running needs `system:write`. Changes
  and runs are written to the audit log under the `maintenance` domain.

---

## Production Deployment

```bash
# 1. Configure .env (DATABASE_URL and JWT_SECRET are required)
cp .env.example .env

# 2. Verify, migrate, build, deploy, and attest the internal/external release revision
pnpm deploy:production
```

The deployment command refuses a dirty/non-`main`/unpushed tree, runs architecture
and runtime-contract checks, lint, backend/frontend tests, writes artifact hashes,
reloads PM2, and verifies both local and public `/api/health` revisions. The backend
serves an atomically published frontend release under `/` and all API routes under
`/api`; ordinary `pnpm build` output is never served directly in production.
A sample Nginx reverse-proxy config is at [`nginx/conf.d/app-stack.conf.example`](nginx/conf.d/app-stack.conf.example).

Managed Docker stacks are local-only. Set `CONTROL_COMPOSE_FILE` to an absolute
path, or create a private `docker-compose.local.yml`. Existing private
`docker-compose.yml` installations remain supported. None of these files belongs
in Git. Deployment health checks use your configured `FRONTEND_URL` and `PORT`.

SSL certificates can be issued and renewed directly from the **Nginx → SSL** panel.

---

## Contributing

Contributions are welcome — bug reports, feature requests, and pull requests.
Please read the **[Contributing guide](CONTRIBUTING.md)** before you start.

> **Language:** English is preferred for issues, pull requests, and commit messages so the project stays accessible to everyone, but **Korean is welcome too**.
> 이슈·PR·커밋 메시지는 **영어 작성을 권장**하지만 **한국어도 괜찮습니다**.

**Quick start:**

1. Open or pick an issue (look for [`good first issue`](https://github.com/kscold/kscold-control/labels/good%20first%20issue))
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) with a scope:

   ```
   feat(frontend): add feature
   fix(backend): fix bug
   refactor(infra): refactor
   chore(deps): update dependencies
   ```

4. Push and open a Pull Request against `main` — the PR template fills in automatically

Every PR runs CI (build + lint), Conventional-Commit title validation, and auto-labeling.
Make sure `pnpm build` passes and relevant docs are updated before submitting.

---

## Source Upload Policy

Folder uploads preserve `.env`, credential/key files, SVG/images, fonts, documents,
lockfiles, editor settings and other original bytes. Content is not rejected for
containing a private key. This private repository is not a secrets vault: users with
repository read access to the project (its owner and administrators) can download
these values. Do not grant repository access to untrusted users. Uploaded files
are not committed to this application's Git repository.

Only dependency/cache/build directories, VCS metadata and generated cache files
are automatically excluded. Files are no longer silently dropped at 1 MiB or
because of their media/binary extension. Server limits remain 50 MiB per file,
2 GiB and 100,000 files per upload; the UI reports a limit violation before sending
instead of removing those files. Unreadable/changed local files are explicitly
listed. Select the folder again to include assets omitted by older uploads.

For an authorized production check, `pnpm test:repository-live-smoke --with-source-assets`
creates and removes a separate synthetic project. It checks the browser upload,
retry/resume, archive byte equality, versioned `.env` reads and unauthenticated
download denial. It never uploads the application's real `.env` or local keys.

Project name repair (administrator maintenance, not an upload filter):

```sh
# Preview only. Never run against a different deployment's environment.
node --env-file=.env scripts/rename-repository-project.mjs old-name new-name
# Apply requires the kscold-control PM2 process to be stopped, then restarted
# immediately after maintenance. Do not stop Docker, databases or other apps.
node --env-file=.env scripts/rename-repository-project.mjs old-name new-name --apply
```

The repair preserves the project ID, contents, archives, staging, receipts and
resumable-session metadata. It writes a private recovery journal under
`~/.local/state/kscold-control/repository-renames` before applying any changes.

## License

[MIT](LICENSE)
