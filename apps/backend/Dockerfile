FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm install --frozen-lockfile --filter @kscold-control/backend...

COPY apps/backend apps/backend
RUN pnpm --filter @kscold-control/backend build

FROM node:22-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./package.json

EXPOSE 4000

CMD ["node", "dist/main.js"]
