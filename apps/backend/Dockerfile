FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production
FROM node:18-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Claude Code CLI 설치 (Mac Mini 호스트에서는 이미 설치되어 있다고 가정)
# RUN npm install -g @anthropic-ai/claude-code

EXPOSE 4000

CMD ["node", "dist/main.js"]
