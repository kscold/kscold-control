#!/usr/bin/env bash
set -euo pipefail
umask 077

state=/app/slacord-deploy
root_keys=/run/gadoc-private/authorized/root
developer_keys=/run/gadoc-private/authorized/developer
runtime_allowed=0
rm -f /run/gadoc-env-apply-blocked
if [[ "${GADOC_START_RUNTIME:-0}" == 1 ]]; then
    if node - "$state" <<'ENV_APPLY_GUARD'
const fs = require('node:fs');
try {
    if (!fs.lstatSync(process.argv[2]).isDirectory()) process.exit(1);
    fs.lstatSync(process.argv[2] + '/env-apply-pending.json');
    process.exit(1);
} catch (error) {
    process.exit(error.code === 'ENOENT' && error.path?.endsWith('/env-apply-pending.json') ? 0 : 1);
}
ENV_APPLY_GUARD
    then
        runtime_allowed=1
    else
        echo 'Application startup deferred: environment apply recovery is required.' >&2
        : > /run/gadoc-env-apply-blocked
    fi
fi
# Colima bind mounts may map host ownership to the developer UID. Protect their parent.
mkdir -p /run/gadoc-private
chown root:root /run/gadoc-private
chmod 700 /run/gadoc-private
if [[ "$runtime_allowed" == 1 ]]; then
    node - "$state" <<'NODE'
const fs = require('node:fs');
const state = process.argv[2];
try {
    const file = state + '/private/migration-verified.json';
    const stat = fs.statSync(file);
    const record = JSON.parse(fs.readFileSync(file));
    if (stat.uid !== 0 || (stat.mode & 0o077) || record.stage !== 'final-cutover' ||
        record.consistency !== 'writers-stopped' || record.targetVolume !== 'gadoc-mongo-data' ||
        record.restored !== true || record.verified !== true) throw new Error();
    const config = JSON.parse(fs.readFileSync(state + '/current/ecosystem.config.json'));
    if (config.apps.length !== 2 || config.apps.some((app, i) => app.uid !== 1002 + i ||
        app.gid !== 1002 + i || JSON.stringify(app.filter_env) !== '[""]')) throw new Error();
} catch {
    console.error('Runtime requires a verified final restore and isolated process identities.');
    process.exit(1);
}
NODE
fi
[[ -s /data/db/WiredTiger ]] || { echo 'Refusing an empty database: restore and verify a backup first.' >&2; exit 1; }
[[ -s /run/gadoc-private/hostkeys/ssh_host_ed25519_key && -s /run/gadoc-private/hostkeys/ssh_host_rsa_key ]]
[[ -s "$root_keys" && -s "$developer_keys" ]]
if grep -Ev '^($|#|restrict,command="(/app/slacord-deploy/tools/ssh-entrypoint\.sh|/usr/local/sbin/gadoc-kms-env)" )' "$root_keys" >/dev/null; then
    echo 'Root keys must be restricted to approved forced commands.' >&2
    exit 1
fi
mkdir -p /run/sshd /run/mongodb /var/log/mongodb /var/log/slacord /root/.ssh /home/gadoc/.ssh
install -m 600 "$root_keys" /root/.ssh/authorized_keys
install -m 600 -o gadoc -g gadoc "$developer_keys" /home/gadoc/.ssh/authorized_keys
chown gadoc:gadoc /home/gadoc /home/gadoc/.ssh
chmod 700 /home/gadoc/.ssh /root/.ssh
chown -R mongodb:mongodb /data/db /run/mongodb /var/log/mongodb
/usr/sbin/sshd -t

runtime_started=0
cleanup() {
    trap - EXIT TERM INT
    if [[ "$runtime_started" == 1 ]]; then
        env -i PATH="$PATH" HOME=/root PM2_HOME=/root/.pm2 pm2 kill >/dev/null 2>&1 || true
    fi
    if [[ -f /run/mongodb/mongod.pid ]]; then
        local pid
        pid="$(cat /run/mongodb/mongod.pid)"
        kill -TERM "$pid" 2>/dev/null || true
        for _ in {1..60}; do
            kill -0 "$pid" 2>/dev/null || break
            sleep 0.5
        done
    fi
}
trap cleanup EXIT TERM INT
gosu mongodb mongod --dbpath /data/db --bind_ip 127.0.0.1 --auth \
    --port 27017 --fork --logpath /var/log/mongodb/mongod.log --pidfilepath /run/mongodb/mongod.pid

if [[ "$runtime_allowed" == 1 ]]; then
    env -i PATH="$PATH" HOME=/root PM2_HOME=/root/.pm2 NODE_ENV=production \
        pm2 start "$state/current/ecosystem.config.json"
    runtime_started=1
fi
/usr/sbin/sshd -D -e &
wait "$!"
