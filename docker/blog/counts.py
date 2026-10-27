"""컨테이너 안에서 실행하며 문서 본문·환경 변수 값은 출력하지 않는다."""
import json
import os
import urllib.request

from pymongo import MongoClient

with MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=5000) as client:
    database = client[os.getenv("MONGODB_DATABASE", "kscold-blog")]
    result = {"version": client.server_info()["version"],
              "counts": {name: database[name].count_documents({})
                         for name in sorted(database.list_collection_names())}}
    try:
        result["fcv"] = client.admin.command({"getParameter": 1, "featureCompatibilityVersion": 1})["featureCompatibilityVersion"]
    except Exception:
        result["fcv"] = "권한 부족"
qdrant_url = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
with urllib.request.urlopen(qdrant_url + "/collections", timeout=5) as response:
    collections = json.load(response)["result"]["collections"]
result["qdrant"] = {}
for collection in collections:
    name = collection["name"]
    with urllib.request.urlopen(qdrant_url + "/collections/" + name, timeout=5) as response:
        info = json.load(response)["result"]
    result["qdrant"][name] = {key: info[key] for key in ("points_count", "status")}
print(json.dumps(result, ensure_ascii=False))
