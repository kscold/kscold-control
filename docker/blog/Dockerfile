# syntax=docker/dockerfile:1
# 빌드 컨텍스트: 이 디렉터리, 추가 컨텍스트 blog: git archive로 추출한 블로그 소스.
# 운영 호스트와 동일한 linux/arm64를 대상으로 한다.
FROM ubuntu:24.04@sha256:24737cef17f4e22b1977df7d9a05e77c4e28b7da5b8911f8d8ccda136bf3573c AS base
ENV DEBIAN_FRONTEND=noninteractive TZ=Asia/Seoul
RUN test "$(dpkg --print-architecture)" = arm64 \
    && apt-get update && apt-get install -y --no-install-recommends \
       ca-certificates curl xz-utils libssl3t64 libffi8 libbz2-1.0 liblzma5 \
       libsqlite3-0 libreadline8t64 libncursesw6 libexpat1 libgomp1 tzdata \
    && rm -rf /var/lib/apt/lists/*

FROM base AS java-builder
RUN curl -fsSL --retry 3 -o /tmp/java.tar.gz https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_aarch64_linux_hotspot_21.0.13_9.tar.gz \
    && echo 'e3522e707fc7dbe2a72c30746b1e7068301a0213ecd213d4491f35a14eb55578  /tmp/java.tar.gz' | sha256sum -c - \
    && mkdir /opt/jdk && tar -xzf /tmp/java.tar.gz -C /opt/jdk --strip-components=1
ENV JAVA_HOME=/opt/jdk PATH=/opt/jdk/bin:$PATH
WORKDIR /build
COPY --from=blog /apps/api/ ./
RUN --mount=type=cache,target=/root/.gradle \
    chmod +x gradlew && ./gradlew --no-daemon --max-workers=2 -Dorg.gradle.jvmargs=-Xmx1024m bootJar \
    && find build/libs -name '*.jar' ! -name '*plain*' -exec cp {} /tmp/blog.jar \;

FROM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS web-builder
WORKDIR /repo
COPY --from=blog / ./
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL=https://kscold.com
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_ADSENSE_ID=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID} NEXT_PUBLIC_ADSENSE_ID=${NEXT_PUBLIC_ADSENSE_ID} \
    API_INTERNAL_URL=http://127.0.0.1:8080/api
RUN npm install --global "$(node -p 'require("./package.json").packageManager.split("+")[0]')" \
    && pnpm install --frozen-lockfile
# 운영 API 없이 컴파일하고, 최초 요청에서 실제 데이터를 렌더링한다.
# compile 모드가 생략하는 타입 검사는 별도로 실행한다.
RUN pnpm --dir apps/web lint \
    && pnpm --dir apps/web build --experimental-build-mode compile \
    && pnpm --dir apps/web type-check \
    && mkdir -p apps/web/.next/standalone/apps/web/.next/static \
    && cp -a apps/web/.next/static/. apps/web/.next/standalone/apps/web/.next/static/ \
    && pnpm --dir apps/web exec next build .next/standalone/apps/web --experimental-build-mode generate-env

FROM base AS python-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libssl-dev libffi-dev libbz2-dev liblzma-dev libsqlite3-dev libreadline-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL --retry 3 -o /tmp/python.tar.xz https://www.python.org/ftp/python/3.13.18/Python-3.13.18.tar.xz \
    && echo 'abb0102e6d4ae027509bcb82327d9dd85515b44a3ba8ad538cfc5e9847029f68  /tmp/python.tar.xz' | sha256sum -c - \
    && mkdir /tmp/python && tar -xJf /tmp/python.tar.xz -C /tmp/python --strip-components=1 \
    && cd /tmp/python && ./configure --prefix=/opt/python --with-ensurepip=install \
    && make -j2 && make install
COPY --from=blog /apps/agent/ /app/agent/
COPY --from=blog /apps/api/src/main/proto/vault_agent.proto /app/agent/proto/vault_agent.proto
COPY agent-requirements.lock /tmp/agent-requirements.lock
RUN /opt/python/bin/python3.13 -m venv /opt/agent-venv \
    && /opt/agent-venv/bin/pip install --no-cache-dir pip==26.2.1 setuptools==84.1.0 \
    && /opt/agent-venv/bin/pip install --no-cache-dir -r /tmp/agent-requirements.lock \
    && /opt/agent-venv/bin/python -c 'from importlib.metadata import version; from pathlib import Path; rows=[s.strip().split("==") for s in Path("/app/agent/requirements.txt").read_text().splitlines() if s.strip() and not s.startswith("#")]; assert all(version(n)==v for n,v in rows), "Agent 요구사항 변경: lock 갱신 필요"' \
    && /opt/agent-venv/bin/python -m grpc_tools.protoc -I/app/agent/proto \
       --python_out=/app/agent/src/agent/grpc --grpc_python_out=/app/agent/src/agent/grpc /app/agent/proto/vault_agent.proto \
    && sed -i 's/^import vault_agent_pb2/from . import vault_agent_pb2/' /app/agent/src/agent/grpc/vault_agent_pb2_grpc.py \
    && /opt/agent-venv/bin/pip freeze > /app/agent/requirements.resolved.txt
RUN PYTHONPATH=/app/agent/src /opt/agent-venv/bin/python -m unittest discover -s /app/agent/tests

FROM base AS binaries
RUN curl -fsSL --retry 3 -o /tmp/jre.tar.gz https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.5%2B8/OpenJDK25U-jre_aarch64_linux_hotspot_25.0.5_8.tar.gz \
    && echo '963931723891302ebb2687178532c3d793d71e2577cd058061c7efb396140a86  /tmp/jre.tar.gz' | sha256sum -c - \
    && mkdir /opt/java && tar -xzf /tmp/jre.tar.gz -C /opt/java --strip-components=1
RUN curl -fsSL --retry 3 -o /tmp/qdrant.tar.gz https://github.com/qdrant/qdrant/releases/download/v1.19.0/qdrant-aarch64-unknown-linux-musl.tar.gz \
    && echo '8986afbbff9ac32d6e2dbe5cabec80565f613f777126096a461ba066573d3245  /tmp/qdrant.tar.gz' | sha256sum -c - \
    && mkdir /opt/qdrant && tar -xzf /tmp/qdrant.tar.gz -C /opt/qdrant

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends supervisor=4.2.5-1ubuntu0.1 tini=0.19.0-1 gnupg libatomic1 \
    && curl -fsSL https://pgp.mongodb.com/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb.gpg \
    && echo 'deb [arch=arm64 signed-by=/usr/share/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse' > /etc/apt/sources.list.d/mongodb.list \
    && apt-get update && apt-get install -y --no-install-recommends \
       mongodb-org-server=8.0.34 mongodb-mongosh=2.14.0 mongodb-database-tools=100.20.0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=binaries /opt/java/ /opt/java/
COPY --from=binaries /opt/qdrant/qdrant /usr/local/bin/qdrant
COPY --from=web-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=python-builder /opt/python/ /opt/python/
COPY --from=python-builder /opt/agent-venv/ /opt/agent-venv/
COPY --from=python-builder /app/agent/ /app/agent/
COPY --from=java-builder /tmp/blog.jar /app/backend/blog.jar
COPY --from=web-builder /repo/apps/web/.next/standalone/ /app/frontend/
COPY --from=web-builder /repo/apps/web/public/ /app/frontend/apps/web/public/
COPY supervisord.conf /etc/supervisor/supervisord.conf
COPY qdrant.yaml /etc/qdrant/config.yaml
COPY entrypoint.sh launch.py healthcheck.py /usr/local/lib/blog/
RUN usermod -u 999 mongodb && groupmod -g 999 mongodb \
    && groupadd -g 10001 blog && useradd -u 10001 -g blog -M -s /usr/sbin/nologin blog \
    && mkdir -p /data/db /app/uploads /qdrant/storage /qdrant/snapshots /run/blog \
    && chown -R blog:blog /app \
    && chown mongodb:mongodb /data/db \
    && chown -R 1000:1000 /qdrant \
    && chmod 755 /usr/local/lib/blog/entrypoint.sh \
    && dpkg-query -W > /usr/local/lib/blog/os-packages.txt
ARG BLOG_REVISION
LABEL org.opencontainers.image.source=https://github.com/kscold/kscold-control \
      io.kscold.blog.revision=${BLOG_REVISION}
ENV PATH=/opt/java/bin:/opt/agent-venv/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    JAVA_HOME=/opt/java PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/agent/src NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    MONGODB_DATABASE=kscold-blog QDRANT_URL=http://127.0.0.1:6333 \
    VAULT_AGENT_GRPC_HOST=127.0.0.1 VAULT_AGENT_GRPC_PORT=9090 \
    API_INTERNAL_URL=http://127.0.0.1:8080/api \
    API_AUTOSTART=true WEB_AUTOSTART=true AGENT_AUTOSTART=true
EXPOSE 3000 8080
HEALTHCHECK --interval=30s --timeout=12s --start-period=120s --retries=3 \
    CMD ["/opt/agent-venv/bin/python", "/usr/local/lib/blog/healthcheck.py"]
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/lib/blog/entrypoint.sh"]
