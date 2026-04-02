# Nginx Conf Policy

Actual instance nginx conf files in this directory are local-only and ignored by git.

Use [app-stack.conf.example](./app-stack.conf.example) as the reference template when creating a real site conf.

Typical local workflow:

1. Copy `app-stack.conf.example` to `nginx/conf.d/<service>.conf`
2. Replace the domain, certificate path, and upstream container names
3. Reload nginx after verifying the config

If a configuration should be shared in git, commit it as `*.conf.example`, not as `*.conf`.
