# GaDoc Instance Migration

Status: production cutover verified on 2026-10-28. The active runtime is
`ubuntu-gadoc`, with its public origin stored in private deployment settings.
The old source is retired; its original MongoDB volume and private backups
remain intact. Existing domain aliases remain only for client migration.

## Production Operation

- Use the dedicated `gadoc-runtime` Compose project, never the old shared service.
- The active private environment file selects runtime mode and the approved SSH
  port. Do not apply rehearsal environment files to production.
- The application origin is an exact HTTPS origin in root-only
  `/app/slacord-deploy/private/public.env` (`GADOC_PUBLIC_ORIGIN`).
- Control imports the existing runtime as a managed container. Its topology
  derives the actual domain/upstream edge from Nginx, not a hardcoded label.
- The final backup was captured with application writers stopped and a MongoDB
  filesystem write lock. All 22 collections, counts, indexes, and database
  accounts matched after a real restore. Production JWT/storage settings and
  deployment SSH identity were preserved.
- Public browser password login/logout, secure session cookies, both domain
  aliases' authenticated WebSockets, workspace authorization, and external
  forced-command SSH were checked. Evidence and private recovery archives
  belong outside Git. Never publish domain account details, keys, or DB dumps.

## Boundaries

- This Compose project is separate from the shared production Compose file.
- MongoDB stays at 7.0.31 for this migration. A version upgrade is a separate task.
- The candidate uses four new external named volumes. Never attach the original
  MongoDB volume to another running mongod, or run a global volume prune.
- SSH defaults to `127.0.0.1:2228`; web, API, and DB ports are not published.
- Developer SSH uses the `gadoc` account and existing trusted public keys.
  Password authentication, root shells, agent forwarding, and remote forwarding
  are disabled. CI retains its forced deployment command and host identity.
- API and web use UIDs 1002 and 1003. Only the API gets its scoped DB URI and
  object-storage credentials. Neither app gets Mongo bootstrap credentials.
- Bind-mounted secrets sit below a root-owned `0700` parent. File modes alone
  are insufficient when Colima maps the host owner to the developer UID.
- MinIO objects remain in the existing private `gadoc` bucket. No bucket policy,
  blog data, Pawpong data, or shared reverse-proxy setting is changed here.
- No Apple signing/notarization credential belongs in this instance. Signing
  an installer is separate from app login, SSH authentication, and HTTPS.

## Rehearsal

The commands below describe a new isolated rehearsal. They are not production
restart instructions and must not overwrite an existing production target.

`node docker/gadoc/backup-instance.mjs capture` creates a live rehearsal backup
of the legacy `ubuntu-slacord` in `~/.config/gadoc/backups`. It does not stop
writes and must not be advertised as a final consistent backup.
`node docker/gadoc/backup-instance.mjs restore-check "$BACKUP"` validates hashes
and performs an actual restore on a disposable, network-isolated MongoDB volume.
The original container and volume are never used as restore destinations.

Before a build or full test run, run `df -h ~`. Stop below 15 GiB free. Use a
dedicated buildx builder, then remove only that builder's cache after validation.

```sh
docker buildx create --name gadoc-migration --driver docker-container colima
docker buildx build --builder gadoc-migration --load \
  -t kscold/ubuntu-gadoc:2026-10-28-r1 docker/gadoc
```

A backup directory must be `0700`, with files `0600`, outside Git. Required
inputs are `manifest.json` with SHA-256 hashes, `restore-verification.json`,
`mongodb.archive.gz`, `database.inventory.json`, `pm2.json`, and
`runtime-and-ssh.tar.gz`. The archive includes the entire deployment state,
private runtime config, releases, and SSH keys. A supplemental
`ssh-host-keys.tar.gz` is accepted. The full-instance Mongo dump includes users
and roles. Verify a real restore with matching MongoDB, counts, and ordered
compound-index keys before using this preparer.

`prepare-instance.mjs` rejects existing candidate volumes/private directories.
It never stops or edits the source. On failure it retains copied volumes for
diagnosis rather than deleting them. Its restore helper has no network and is
removed afterwards. The app deployment scripts supplied as the third argument
must include the credential isolation / UID-preserving deployment changes.

```sh
node docker/gadoc/prepare-instance.mjs "$BACKUP" "$PRIVATE_DIR" "$GADOC_REPOSITORY"
docker compose --env-file "$PRIVATE_DIR/candidate.env" \
  -f docker/gadoc/compose.yaml up -d
node docker/gadoc/verify-staged-instance.mjs "$PRIVATE_DIR"
```

The verifier uses a temporary developer key, pins the existing SSH host key,
and removes its key in `finally`. It checks actual SSH access, rejected password
login/root commands/forwarding, filesystem secret boundaries, anonymous DB
denial, the application's `readWrite@slacord` role, and inactive app ports.
It does not write production records.

`GADOC_START_RUNTIME=0` is deliberate. Starting a copied application against a
copied DB can still send duplicate notifications or integration requests.
Enabling it without a root-only final-restore record is rejected before MongoDB
starts. An empty DB is rejected instead of being silently initialized.

## Local Authentication

For remote development, tunnel only the development web/API ports:

```sh
ssh -N -p 2226 -L 3302:127.0.0.1:3302 -L 18086:127.0.0.1:18086 gadoc@host.example.test
```

This final SSH port is available only after the approved cutover. Until then,
the candidate is host-local on 2228. A local API must use a separate development
database/account, separate JWT secret, and separate scoped storage credentials,
not auto-discover production credentials. Configure these in a private local
profile, never in Git. Development services have not been provisioned by the
instance preparer.

Keep the browser on one hostname (`127.0.0.1`, not a mix with `localhost`):
web 3302, API/socket 18086, and `INTERNAL_API_URL=http://127.0.0.1:18086`.
Use `NODE_ENV=development` only for that isolated API. Do not turn off Secure
cookies or expand production CORS to solve local login. The public app retains
Secure, HttpOnly, SameSite=Lax authentication cookies.

## Final Cutover Gate

These steps require explicit downtime approval; the preparer does not run them.

1. Coordinate CI and take the source deployment lock. Confirm no newer main
   revision has deployed since the rehearsal. Stop only GaDoc writers; also
   exclude direct external DB writes. The standalone MongoDB has no oplog
   backup guarantee during ongoing writes.
2. Take a new full DB dump, runtime/config backup, count/index inventory, and
   checksums while writes are stopped. Keep both this final backup and the
   rehearsal backup. Same-host copies are not off-host disaster recovery.
3. Stop the candidate's MongoDB. Restore the final dump into a new verified
   copy, including users/roles. Do not reuse a stale rehearsal as final data.
   Compare counts/indexes and authenticate using the application role.
4. Regenerate isolated runtime config from the final PM2 snapshot, keeping the
   current revision, JWT secret, scoped DB URI, and private MinIO settings.
   Preserve API/web UIDs, Next writable paths, and private config file modes.
5. Only after successful verification, create root-owned `0600`
   `/app/slacord-deploy/private/migration-verified.json` with
   `stage: "final-cutover"`, `consistency: "writers-stopped"`,
   `targetVolume: "gadoc-mongo-data"`, `restored: true`, `verified: true`, and
   the verified backup/revision/time. This is an activation record, not a way
   to bypass restoration checks.
6. Stop the old container without deleting it or its volume. Set candidate
   `GADOC_START_RUNTIME=1`, `GADOC_SSH_PORT=2226`, and the approved SSH bind
   address. Update only GaDoc nginx upstreams from `ubuntu-slacord` to
   `ubuntu-gadoc`, run `nginx -t`, then reload nginx. Keep the domain and TLS
   certificates. Do not recreate other Compose services.
7. Verify health, release SHA, login/logout/cookies, files, socket access, and
   the existing CI forced-command check through the external SSH route.
   Update the shared source Compose/topology only after the new runtime passes.
8. Before the new app accepts writes, rollback can restore the old routing and
   container. After it accepts writes, **never** switch to the stale old DB:
   quiesce, back up, and synchronize the new data first.

## Validation Evidence (2026-10-28)

The rehearsal restored 20 collections and 2 DB users on MongoDB 7.0.31, with
matching counts and index definitions. Authentication/permission verification
passed nine live checks. A separate, network-isolated disposable container
passed real PM2 non-root activation, secret filtering, cross-user `/proc`
denial, Next writable-cache checks, and failed-deployment rollback. No production
cutover, final consistent backup, external candidate SSH, or developer login
service is claimed by that rehearsal alone; the separate production checks
above cover the final cutover.

PM2 6.0.14's implementation ignores boolean `filter_env: true`; the deployment
uses `filter_env: [""]` to match every inherited key, confirmed against real
process environments, not only a JSON assertion.
