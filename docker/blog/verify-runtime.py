"""검증 복사본에서만 API·SSR·인증·Agent 읽기를 확인한다. 본문/토큰은 출력하지 않는다."""
import base64
import hashlib
import hmac
import html
import json
import os
import re
import socket
import sys
import time
import urllib.request
from urllib.parse import quote

import grpc
from pymongo import MongoClient
from pymongo.uri_parser import parse_uri
from agent.grpc import vault_agent_pb2 as messages
from agent.grpc import vault_agent_pb2_grpc as services

sys.path.insert(0, "/usr/local/lib/blog")
from runtime_env import local_mongodb_uri

os.environ["MONGODB_URI"] = local_mongodb_uri(os.environ["MONGODB_URI"], "127.0.0.1:27017")

assert os.environ.get("BLOG_VERIFY") == "1", "격리 검증 컨테이너에서만 실행 가능"
assert not os.environ.get("DISCORD_BOT_TOKEN"), "검증 Discord 토큰은 비어 있어야 함"
assert not os.environ.get("SMTP_PASSWORD"), "검증 SMTP 암호는 비어 있어야 함"
assert os.environ.get("OPENAI_BASE_URL", "").startswith("http://127.0.0.1:"), "외부 모델 호출 차단 필요"
assert parse_uri(os.environ["MONGODB_URI"])["nodelist"] == [("127.0.0.1", 27017)], "검증 MongoDB는 컨테이너 내부만 허용"

try:
    connection = socket.create_connection(("1.1.1.1", 443), timeout=2)
except OSError:
    print("PASS external egress blocked")
else:
    connection.close()
    raise AssertionError("검증 네트워크에서 외부 통신이 가능함")


def read(path, *, web=False, token=None):
    address = "http://127.0.0.1:" + ("3000" if web else "8080") + path
    headers = {"Authorization": "Bearer " + token} if token else {}
    with urllib.request.urlopen(urllib.request.Request(address, headers=headers), timeout=30) as response:
        assert response.status == 200
        body = response.read().decode()
    return body if web else json.loads(body).get("data", json.loads(body))


read("/api/health")
read("/", web=True)
print("PASS api health and web root 200")
posts = read("/api/posts?page=0&size=10")["content"]
post = next(item for item in posts if not item.get("restricted"))
read("/api/posts/slug/" + quote(post["slug"], safe=""))
post_path = "/blog/" + quote(post["category"]["slug"], safe="") + "/" + quote(post["slug"], safe="")
page = read(post_path, web=True)
assert post["title"] in html.unescape(page), "글 제목 SSR 확인 실패"
assert "Application error: a server-side exception" not in page
chunk = re.search(r'src="(/_next/static/[^" ]+\.js)"', page)
assert chunk, "클라이언트 JS 누락"
read(html.unescape(chunk[1]), web=True)
print("PASS post detail API, SSR title and client JS")
page = read("/login", web=True)
assert 'type="password"' in page, "로그인 암호 입력란 없음"
print("PASS administrator login form")

with MongoClient(os.environ["MONGODB_URI"]) as client:
    database = client[os.getenv("MONGODB_DATABASE", "kscold-blog")]
    note = database.vault_notes.find_one({"slug": {"$regex": ".+"}}, {"slug": 1, "title": 1})
    read("/api/vault/notes/slug/" + quote(note["slug"], safe=""))
    page = read("/vault/" + quote(note["slug"], safe=""), web=True)
    assert note["title"] in html.unescape(page), "Vault 제목 SSR 확인 실패"
    read("/vault", web=True)
    print("PASS Vault API, index and detail SSR")
    user = database.users.find_one({"role": "ADMIN"})
    assert user, "검증 백업에 관리자 계정 없음"
    payload = {"sub": str(user["_id"]), "role": "ADMIN", "type": "access",
               "credentialVersion": user.get("credentialVersion", 0),
               "iat": int(time.time()), "exp": int(time.time()) + 120}
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")
    signing = encode({"alg": "HS256", "typ": "JWT"}) + b"." + encode(payload)
    key = base64.b64decode(os.environ["JWT_SECRET"])
    signature = base64.urlsafe_b64encode(hmac.new(key, signing, hashlib.sha256).digest()).rstrip(b"=")
    token = (signing + b"." + signature).decode()
    read("/api/admin/chat/rooms", token=token)
    read("/api/admin/chat/messages?page=0&size=1", token=token)
    print("PASS authenticated chat GET (verification-only JWT)")

with grpc.insecure_channel("127.0.0.1:9090") as channel:
    stub = services.VaultAgentServiceStub(channel)
    response = stub.Search(messages.SearchRequest(
        query=note["title"], limit=3,
        content_access_scope=messages.ContentAccessScope(full_content_access=True)), timeout=30)
    assert response.sources, "Agent 검색 결과 없음"
    print(f"PASS Agent gRPC search ({len(response.sources)} sources; external LLM disabled)")
