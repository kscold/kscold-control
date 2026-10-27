"""기존 경로와 .env 호환을 유지하고 앱만 비특권 계정으로 실행한다."""
import os
import shlex
import sys
import time
import urllib.request

from dotenv import load_dotenv
from pymongo import MongoClient
from runtime_env import local_mongodb_uri

service = sys.argv[1]
if service in ("api", "agent"):
    load_dotenv("/app/backend/.env", override=False)
    os.environ["MONGODB_URI"] = local_mongodb_uri(os.environ["MONGODB_URI"], os.environ["BLOG_MONGODB_HOST"])

if service in ("api", "agent"):
    for attempt in range(90):
        try:
            with MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=1000) as mongo:
                mongo.admin.command("ping")
            if service == "agent":
                with urllib.request.urlopen("http://127.0.0.1:6333/readyz", timeout=2):
                    pass
            break
        except Exception:
            if attempt == 89:
                raise SystemExit(f"{service}: 데이터 저장소 준비 시간 초과") from None
            time.sleep(1)

if service == "api":
    os.chdir("/app/backend")
    command = ["/opt/java/bin/java", *shlex.split(os.getenv("BLOG_JAVA_OPTS", "-Xms128m -Xmx768m")),
               "-jar", "blog.jar", "--spring.profiles.active=prod", "--server.port=8080"]
elif service == "web":
    os.chdir("/app/frontend/apps/web")
    os.environ.update(HOSTNAME="0.0.0.0", PORT="3000")
    os.environ.setdefault("NODE_OPTIONS", "--max-old-space-size=512")
    command = ["/usr/local/bin/node", "server.js"]
elif service == "agent":
    os.chdir("/app/agent")
    command = ["/opt/agent-venv/bin/python", "-m", "agent.main"]
else:
    raise SystemExit("알 수 없는 서비스")

os.setgroups([])
os.setgid(10001)
os.setuid(10001)
os.execvpe(command[0], command, os.environ)
