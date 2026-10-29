FROM ubuntu:22.04

ARG NODE_VERSION=22.22.1
ARG MONGO_VERSION=7.0.31
ARG PNPM_VERSION=10.34.9
ARG PM2_VERSION=6.0.14
ENV DEBIAN_FRONTEND=noninteractive TZ=Asia/Seoul

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg openssh-server openssh-client git tini \
    xz-utils procps util-linux gosu \
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
    curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /etc/apt/keyrings/mongodb.gpg; \
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse\n' "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/mongodb-org-7.0.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends "mongodb-org-server=${MONGO_VERSION}" mongodb-mongosh mongodb-database-tools; \
    rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_*; \
    groupadd --gid 1001 gadoc; useradd --uid 1001 --gid gadoc --create-home --shell /bin/bash gadoc; \
    groupadd --gid 1002 gadoc-server; useradd --uid 1002 --gid gadoc-server --no-create-home --shell /usr/sbin/nologin gadoc-server; \
    groupadd --gid 1003 gadoc-web; useradd --uid 1003 --gid gadoc-web --no-create-home --shell /usr/sbin/nologin gadoc-web; \
    mkdir -p /data/db /app /run/sshd /run/mongodb /run/gadoc-private /var/log/mongodb /var/log/slacord /root/.ssh /root/.pm2; \
    chmod 700 /root/.ssh /root/.pm2 /run/gadoc-private

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
