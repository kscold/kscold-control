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

| Category | Capabilities |
|---|---|
| **AI Terminal** | Claude Code workspace · Claude Chat · OpenAI Chat API (GPT-4o) · OpenAI Codex CLI — multi-tab |
| **Docker** | Container lifecycle, real-time log streaming, archive log viewer |
| **Nginx** | Virtual host management, SSL issuance & renewal (Let's Encrypt) |
| **Repository** | Source upload, version history snapshots, diff viewer, file browser |
| **Audit** | AOP-based automatic audit log, CSV export, actor/target insights |
| **Security** | IP ban management, JWT RBAC, permission guards |
| **Logs** | Unified viewer — backend · PM2 · Nginx · Docker · blog container logs |
| **Network** | Topology graph (React Flow), UPnP port management |
| **System** | Real-time CPU / memory / disk, Nginx status, host info |

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
│           └── pages/
├── nginx/                    # Nginx config templates
├── scripts/                  # Utility shell scripts
└── .env.example              # Environment variable reference
```

**Backend** — Domain → Application → Presentation (Clean Architecture)  
**Frontend** — Feature-Sliced Design (FSD): entities / features / pages  
**Realtime** — Socket.io namespaces: `/terminal` · `/claude-chat` · `/openai-chat`  
**Package manager** — pnpm workspaces + Turborepo

---

## Quick Start

### Prerequisites

| Tool | Min version |
|------|-------------|
| Node.js | 20 |
| pnpm | 9 |
| PostgreSQL | 14 |
| Docker | 24 (optional) |

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

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `JWT_SECRET` | — | JWT signing secret (required) |
| `PORT` | `4000` | Backend HTTP/WS port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |
| `NODE_ENV` | `development` | `production` disables TypeORM auto-sync |
| `CLAUDE_WORKING_DIR` | `$HOME` | Working directory for AI coding sessions |
| `OPENAI_API_KEY` | — | OpenAI API key (Chat API + Codex CLI) |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model for Chat API |
| `CODEX_BIN` | `codex` | Path to Codex binary |
| `LOG_LEVEL` | `info` | Winston log level |

---

## Production Deployment

```bash
# 1. Build everything
pnpm build

# 2. Start with PM2
pm2 start ecosystem.config.js --update-env
pm2 save
```

The backend serves the built frontend under `/` and all API routes under `/api`.  
A sample Nginx reverse-proxy config is at [`nginx/conf.d/app-stack.conf.example`](nginx/conf.d/app-stack.conf.example).

SSL certificates can be issued and renewed directly from the **Nginx → SSL** panel.

---

## Contributing

Contributions are welcome — bug reports, feature requests, and pull requests.

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit using conventional commits:

   ```
   feat(frontend): add feature
   fix(backend): fix bug
   refactor(infra): refactor
   chore(deps): update dependencies
   ```

4. Push and open a Pull Request against `main`

Please update relevant documentation and ensure the build passes (`pnpm build`) before submitting.

---

## License

[MIT](LICENSE)
