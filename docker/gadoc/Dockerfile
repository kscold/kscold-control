FROM ubuntu:22.04

ARG NODE_VERSION=22.22.1
ARG MONGO_SERIES=9.0
# 9.x 부터 서명 키 파일 이름이 server-9.asc (8.0 까지는 server-8.0.asc)
ARG MONGO_KEY=9
ARG MONGO_VERSION=9.0.4
ARG PNPM_VERSION=10.34.9
ARG PM2_VERSION=6.0.14
# 문서 다이어그램(Mermaid) 서버 렌더가 쓰는 Playwright — GaDoc 저장소 pnpm-lock 의 버전과 맞춘다
ARG PLAYWRIGHT_VERSION=1.64.1
ENV DEBIAN_FRONTEND=noninteractive TZ=Asia/Seoul

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg openssh-server openssh-client git tini \
    xz-utils procps util-linux gosu ffmpeg fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

RUN set -eu; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in amd64) node_arch=x64;; arm64) node_arch=arm64;; *) exit 1;; esac; \
    archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"; \
    curl -fsSLo "/tmp/$archive" "https://nodejs.org/dist/v${NODE_VERSION}/$archive"; \
    curl -fsSLo /tmp/node-shasums "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    cd /tmp; grep "  $archive\$" node-shasums | sha256sum -c -; \
    tar -xJf "$archive" -C /usr/local --strip-components=1; \
    npm install -g "pnpm@${PNPM_VERSION}" "pm2@${PM2_VERSION}"; \
    npm cache clean --force; rm -f "$archive" node-shasums

RUN set -eu; \
    mkdir -p /etc/apt/keyrings; \
    curl -fsSL "https://pgp.mongodb.com/server-${MONGO_KEY}.asc" | gpg --dearmor -o /etc/apt/keyrings/mongodb.gpg; \
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/%s multiverse\n' "$(dpkg --print-architecture)" "${MONGO_SERIES}" > "/etc/apt/sources.list.d/mongodb-org-${MONGO_SERIES}.list"; \
    apt-get update; \
    apt-get install -y --no-install-recommends "mongodb-org-server=${MONGO_VERSION}" mongodb-mongosh mongodb-database-tools; \
    rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_*; \
    groupadd --gid 1001 gadoc; useradd --uid 1001 --gid gadoc --create-home --shell /bin/bash gadoc; \
    groupadd --gid 1002 gadoc-server; useradd --uid 1002 --gid gadoc-server --no-create-home --shell /usr/sbin/nologin gadoc-server; \
    groupadd --gid 1003 gadoc-web; useradd --uid 1003 --gid gadoc-web --no-create-home --shell /usr/sbin/nologin gadoc-web; \
    mkdir -p /data/db /app /run/sshd /run/mongodb /run/gadoc-private /var/log/mongodb /var/log/slacord /root/.ssh /root/.pm2; \
    chmod 700 /root/.ssh /root/.pm2 /run/gadoc-private

# 앱 프로세스(uid 1002)는 홈이 없어 기본 브라우저 경로를 못 쓰므로 공용 경로에 두고,
# 같은 경로를 KMS 의 PLAYWRIGHT_BROWSERS_PATH 로 앱 환경에 넣는다 (PM2 는 이미지 ENV 를 물려받지 않음)
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN set -eu; \
    apt-get update; \
    npx -y "playwright@${PLAYWRIGHT_VERSION}" install --with-deps --only-shell chromium; \
    chmod -R a+rX /opt/ms-playwright; \
    npm cache clean --force; rm -rf /var/lib/apt/lists/* /root/.npm

COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/gadoc-entrypoint
COPY healthcheck.sh /usr/local/bin/gadoc-healthcheck
COPY gadoc-kms-env.sh /usr/local/sbin/gadoc-kms-env
RUN chmod 755 /usr/local/bin/gadoc-entrypoint /usr/local/bin/gadoc-healthcheck /usr/local/sbin/gadoc-kms-env

ENV GADOC_START_RUNTIME=0
WORKDIR /home/gadoc
EXPOSE 22
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD ["/usr/local/bin/gadoc-healthcheck"]
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/gadoc-entrypoint"]
