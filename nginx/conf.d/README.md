# Nginx Conf Policy

Actual instance nginx conf files in this directory are local-only and ignored by git.

Use [app-stack.conf.example](./app-stack.conf.example) as the reference template when creating a real site conf.
KSCOLD 운영 설정은 [kscold.com.conf.example](./kscold.com.conf.example)을 기준으로 동기화합니다.
공개 GoLe 개발 주소를 닫아 둘 때는
[gole.kscold.com.off.conf.example](./gole.kscold.com.off.conf.example)을
`gole.kscold.com.off.conf`로 복사해 사용합니다. 이 설정은 다른 기본 가상호스트로 요청이
잘못 흘러가지 않게 HTTP와 HTTPS에서 모두 `410 Gone`을 반환합니다.

Typical local workflow:

1. Copy `app-stack.conf.example` to `nginx/conf.d/<service>.conf`
2. Replace the domain, certificate path, and upstream container names
3. Reload nginx after verifying the config

If a configuration should be shared in git, commit it as `*.conf.example`, not as `*.conf`.
