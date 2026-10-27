"""본문이나 접속 비밀값을 출력하지 않고 각 서비스의 준비 상태를 확인한다."""
import sys
import urllib.request

import grpc

checks = {"api": "http://127.0.0.1:8080/api/health",
          "web": "http://127.0.0.1:3000/", "qdrant": "http://127.0.0.1:6333/readyz"}
failed = []
for service, url in checks.items():
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            if response.status != 200:
                failed.append(service)
    except Exception:
        failed.append(service)
try:
    with grpc.insecure_channel("127.0.0.1:9090") as channel:
        grpc.channel_ready_future(channel).result(timeout=2)
except Exception:
    failed.append("agent")
if failed:
    print("준비되지 않은 서비스: " + ", ".join(failed))
    sys.exit(1)
