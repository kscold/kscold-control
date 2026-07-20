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
| **Repository**  | Source upload, version history snapshots, diff viewer, file browser                           |
| **Audit**       | AOP-based automatic audit log, CSV export, actor/target insights                              |
| **Security**    | IP ban management, JWT RBAC, permission guards                                                |
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
cd apps/backend && npx ts-node src/seed.ts
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

| Variable             | Default                 | Description                              |
| -------------------- | ----------------------- | ---------------------------------------- |
| `DATABASE_URL`       | —                       | PostgreSQL connection string (required)  |
| `JWT_SECRET`         | —                       | JWT signing secret (required)            |
| `PORT`               | `4000`                  | Backend HTTP/WS port                     |
| `FRONTEND_URL`       | `http://localhost:3000` | CORS allowed origin                      |
| `NODE_ENV`           | `development`           | `production` disables TypeORM auto-sync  |
| `CLAUDE_WORKING_DIR` | `$HOME`                 | Working directory for AI coding sessions |
| `OPENAI_API_KEY`     | —                       | OpenAI API key (Chat API + Codex CLI)    |
| `OPENAI_MODEL`       | `gpt-4o`                | OpenAI model for Chat API                |
| `CODEX_BIN`          | `codex`                 | Path to Codex binary                     |
| `LOG_LEVEL`          | `info`                  | Winston log level                        |

---

## Production Deployment

```bash
# 1. Configure required runtime secrets
export DATABASE_URL='postgresql://...'
export JWT_SECRET="$(openssl rand -base64 48)"

# 2. Build everything
pnpm build

# 3. Start with PM2
pm2 start ecosystem.config.js --update-env
pm2 save
```

The backend serves the built frontend under `/` and all API routes under `/api`.  
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
