# kscold-control

A self-hosted infrastructure governance panel for managing Docker containers, Nginx, SSL certificates, AI coding assistants (Claude Code · OpenAI Chat API · Codex CLI), source repositories, and system monitoring — all from a single web interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev)
[![v1.0.0](https://img.shields.io/badge/release-v1.0.0-brightgreen)](https://github.com/kscold/kscold-control/releases/tag/v1.0.0)

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
| **Key Vault**   | Approval-gated GoLe `.env`, encrypted DB backups, Secret Manager version deploys              |
| **Logs**        | Unified viewer — backend · PM2 · Nginx · Docker · blog container logs                         |
| **Network**     | Topology graph (React Flow), UPnP port management                                             |
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
│   │       ├── key-management/   # GoLe Secret Manager, encrypted backups, deployment
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
| Node.js    | 20            |
| pnpm       | 9             |
| PostgreSQL | 14            |
| Docker     | 24 (optional) |

### One-command setup

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

| Variable                        | Default                 | Description                               |
| ------------------------------- | ----------------------- | ----------------------------------------- |
| `DATABASE_URL`                  | —                       | PostgreSQL connection string (required)   |
| `JWT_SECRET`                    | —                       | JWT signing secret (required)             |
| `PORT`                          | `4000`                  | Backend HTTP/WS port                      |
| `FRONTEND_URL`                  | `http://localhost:3000` | CORS allowed origin                       |
| `NODE_ENV`                      | `development`           | `production` disables TypeORM auto-sync   |
| `CLAUDE_WORKING_DIR`            | `$HOME`                 | Working directory for AI coding sessions  |
| `OPENAI_API_KEY`                | —                       | OpenAI API key (Chat API + Codex CLI)     |
| `OPENAI_MODEL`                  | `gpt-4o`                | OpenAI model for Chat API                 |
| `CODEX_BIN`                     | `codex`                 | Path to Codex binary                      |
| `LOG_LEVEL`                     | `info`                  | Winston log level                         |
| `KEY_MANAGEMENT_ENCRYPTION_KEY` | —                       | Base64-encoded 32-byte AES-GCM backup key |

## GoLe Key Management API

Public registration creates a `pending_approval` account with no permissions.
An administrator approves it from **RBAC → Users → 대시보드 + GoLe 키 관리자 승인**. The
approved `key_manager` role receives only `dashboard:read`, `secrets:read`,
`secrets:reveal`, `secrets:write`, and `secrets:deploy`.

### Read-only user preview

Legacy `admin` and `super_admin` users can select **QA 화면 보기** on a
non-admin user card to inspect the application with that user's current roles.
The preview token expires after 15 minutes. A persistent banner returns to the
original administrator immediately; mutating HTTP requests and all Terminal,
Claude, and Codex WebSocket sessions are rejected server-side during preview.
Each preview start is recorded in the RBAC audit timeline.

Get a JWT and the current immutable Secret Manager version:

```bash
TOKEN="$(curl -fsS https://control.kscold.com/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"email":"developer@example.com","password":"your-password"}' \
  | jq -r '.accessToken')"

curl -fsS https://control.kscold.com/api/key-management/targets \
  -H "Authorization: Bearer $TOKEN"
```

Change one key. `secretValue` is the literal text after `=` in the `.env` file.
Use the version returned by the previous request; stale versions return HTTP 409.

```bash
curl -fsS -X PATCH \
  https://control.kscold.com/api/key-management/targets/gole-production/environment/MY_KEY \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"secretValue":"new-value","expectedVersion":"1"}'
```

Replace the complete `.env` without putting its content in command arguments:

```bash
jq -n --rawfile env .env --arg version '1' \
  '{envFile: $env, expectedVersion: $version}' | \
curl -fsS -X PUT \
  https://control.kscold.com/api/key-management/targets/gole-production/environment \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' --data-binary @-
```

Every PATCH, PUT, and restore first stores the current environment in PostgreSQL
as AES-256-GCM ciphertext. A failed backup aborts the operation before creating a
Secret Manager version. A successful change dispatches the exact version to the
GoLe self-hosted runner; failed readiness restores the previous VM file.

```bash
# Deployment and encrypted-backup ledger
curl -fsS \
  https://control.kscold.com/api/key-management/targets/gole-production/backups \
  -H "Authorization: Bearer $TOKEN"

# Restore still creates a new pre-change backup and immutable secret version
curl -fsS -X POST \
  https://control.kscold.com/api/key-management/targets/gole-production/backups/BACKUP_ID/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"expectedVersion":"2"}'
```

---

## Production Deployment

```bash
# 1. Configure .env (DATABASE_URL and JWT_SECRET are required)
cp .env.example .env

# 2. Apply the encrypted-backup ledger schema when first enabling Key Vault
bash scripts/migrate-key-management.sh

# 3. Verify, build, deploy, and attest the internal/external release revision
pnpm deploy:production
```

The deployment command refuses a dirty/non-`main`/unpushed tree, runs architecture
and runtime-contract checks, lint, backend/frontend tests, writes artifact hashes,
reloads PM2, and verifies both local and public `/api/health` revisions. The backend
serves the built frontend under `/` and all API routes under `/api`.
A sample Nginx reverse-proxy config is at [`nginx/conf.d/app-stack.conf.example`](nginx/conf.d/app-stack.conf.example).

For the optional Slacord compose service, copy `env/slacord.env.example` to
`env/slacord.env` and replace every placeholder before starting the stack.
The compose file allows that file to be absent so unrelated services can still
be validated with `docker compose config`, but Slacord itself needs its runtime
secrets to start correctly.

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

## License

[MIT](LICENSE)
