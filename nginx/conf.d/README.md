# Nginx 설정 / Configuration

공개 저장소에는 [범용 템플릿](./app-stack.conf.example)만 보관합니다.
실제 도메인, 인증서, 업스트림 주소가 들어간 `*.conf`와 백업본은 로컬 전용입니다.
Only generic templates belong in Git. Real domains, certificates and upstreams stay local.

1. `app-stack.conf.example`을 `<service>.conf`로 복사합니다.
2. 운영자가 자신의 도메인, 인증서 경로, 업스트림 주소를 입력합니다.
3. 실제 컨테이너에서 `nginx -t`가 성공한 경우에만 reload합니다.

`pnpm check:nginx`는 별도의 임시 컨테이너에서 공개 템플릿만 검사합니다.
현재 운영 Nginx를 재시작하거나 실제 사이트 설정을 바꾸지 않습니다.
실제 설정 파일과 인증서를 Git에 추가하지 마세요.

## 실제 접속 주소 리스너 / Real client IP listeners

모든 사이트 블록은 기존 `listen 80;`·`listen 443 ssl;` 옆에 PROXY protocol 리스너를 함께 둡니다.

```nginx
listen 80;
listen 8080 proxy_protocol;
...
listen 443 ssl;
listen 8443 ssl proxy_protocol;
```

호스트의 TCP 프록시(HAProxy 등)가 `send-proxy-v2`로 8080/8443에 연결하면
`nginx.conf`의 `real_ip_header proxy_protocol` 설정으로 `$remote_addr`가 실제 접속 주소가 됩니다.
80/443으로 들어온 연결은 그대로 동작하므로 전환 전후 어느 쪽 경로든 같은 블록이 응답합니다.
`/.well-known/acme-challenge/`는 HTTP 블록에 있어 8080 경로로도 인증서 갱신이 됩니다.
kscold-control이 새로 만드는 사이트 설정도 같은 리스너를 씁니다.
8080/8443은 호스트 루프백(`127.0.0.1`)에만 게시해야 바깥에서 PROXY 헤더를 위조할 수 없습니다.
