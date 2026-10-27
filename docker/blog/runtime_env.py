"""시크릿 파일을 보존하면서 Supervisor가 지정한 내부 주소만 적용함."""
from urllib.parse import urlsplit, urlunsplit


def local_mongodb_uri(uri, host):
    if host != "127.0.0.1:27017":
        raise ValueError("통합 MongoDB 주소는 loopback만 허용함")
    try:
        parsed = urlsplit(uri)
        if parsed.scheme != "mongodb" or not parsed.netloc:
            raise ValueError()
        credentials, separator, _ = parsed.netloc.rpartition("@")
        authority = credentials + separator + host if separator else host
        return urlunsplit((parsed.scheme, authority, parsed.path, parsed.query, parsed.fragment))
    except ValueError:
        raise ValueError("표준 MongoDB URI가 필요함: 시크릿 파일은 변경하지 않음") from None
