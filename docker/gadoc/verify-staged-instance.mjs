import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const privateDir = fs.realpathSync(process.argv[2]);
const container = 'ubuntu-gadoc';
const docker = (args, input) => execFileSync('docker', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
const inspected = JSON.parse(docker(['inspect', container]))[0];
assert.deepEqual(inspected.HostConfig.PortBindings, { '22/tcp': [{ HostIp: '127.0.0.1', HostPort: '2228' }] });
assert.ok(inspected.Config.Env.includes('GADOC_START_RUNTIME=0'));
assert.equal(inspected.Mounts.find((mount) => mount.Destination === '/data/db').Name, 'gadoc-mongo-data');
assert.ok(!inspected.Mounts.some((mount) => mount.Name === 'kscold-control_slacord-mongo-data'));
const temp = fs.mkdtempSync(path.join(privateDir, 'ssh-verification-'));
fs.chmodSync(temp, 0o700);
const key = path.join(temp, 'key');
execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'gadoc-ephemeral-verification', '-f', key]);
const knownHosts = path.join(temp, 'known_hosts');
fs.writeFileSync(knownHosts, `[127.0.0.1]:2228 ${fs.readFileSync(path.join(privateDir, 'hostkeys/ssh_host_ed25519_key.pub'), 'utf8')}`, { mode: 0o600 });
const options = ['-T', '-p', '2228', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${knownHosts}`, '-o', 'ConnectTimeout=10'];
const checks = [];
try {
  const authorized = fs.readFileSync(path.join(privateDir, 'authorized/developer'), 'utf8') + fs.readFileSync(`${key}.pub`, 'utf8');
  docker(['exec', '-i', container, 'sh', '-c', 'umask 077; cat > /home/gadoc/.ssh/authorized_keys; chown gadoc:gadoc /home/gadoc/.ssh/authorized_keys'], authorized);
  const ssh = (args, identity = key) => spawnSync('ssh', [...options, '-i', identity, ...args], { encoding: 'utf8', timeout: 15000 });
  let result = ssh(['gadoc@127.0.0.1', 'id -un']);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'gadoc'); checks.push('developer-key-login');
  result = ssh(['gadoc@127.0.0.1', 'for file in /app/slacord-deploy/current/ecosystem.config.json /app/slacord-deploy/private/server.env /root/.ssh/authorized_keys /run/gadoc-private/hostkeys/ssh_host_ed25519_key /data/db/WiredTiger; do test ! -r "$file" || exit 1; done']);
  assert.equal(result.status, 0, result.stderr); checks.push('developer-cannot-read-production-secrets');
  result = ssh(['root@127.0.0.1', 'id'], path.join(os.homedir(), '.ssh/slacord-actions-deploy'));
  assert.equal(result.status, 64, result.stderr); checks.push('ci-key-rejects-arbitrary-root-shell');
  result = ssh(['-o', 'PreferredAuthentications=password', '-o', 'PubkeyAuthentication=no', 'gadoc@127.0.0.1', 'true']);
  assert.equal(result.status, 255); assert.match(result.stderr, /Permission denied/); checks.push('password-login-disabled');
  result = ssh(['-W', '127.0.0.1:22', 'gadoc@127.0.0.1']);
  assert.equal(result.status, 255); assert.match(result.stderr, /administratively prohibited/); checks.push('nonapproved-forward-target-denied');
  const db = JSON.parse(docker(['exec', '-i', container, 'node'], `
    const fs=require('fs'),assert=require('assert/strict'),net=require('net');
    const state='/app/slacord-deploy';const release=fs.realpathSync(state+'/current');
    const config=JSON.parse(fs.readFileSync(release+'/ecosystem.config.json'));
    const mongoose=require(require.resolve('mongoose',{paths:[release+'/packages/server']}));
    (async()=>{
      assert.ok(config.apps.every((a,i)=>a.uid===1002+i&&a.gid===1002+i&&JSON.stringify(a.filter_env)==='[""]'));
      assert.ok(!Object.keys(config.apps[1].env).some(k=>/^(MONGO|MINIO|JWT|DISCORD|SLACK|GITHUB|AWS)_?/.test(k)));
      const anonymous=await mongoose.createConnection('mongodb://127.0.0.1:27017/slacord').asPromise();
      try{await assert.rejects(anonymous.db.collection('users').findOne(),e=>e.code===13);}finally{await anonymous.close();}
      const app=await mongoose.createConnection(config.apps[0].env.MONGODB_URI).asPromise();
      try{assert.ok(await app.db.collection('users').countDocuments());
        await assert.rejects(app.db.admin().command({usersInfo:1}),e=>e.code===13);
        const auth=await app.db.command({connectionStatus:1});
        assert.deepEqual(auth.authInfo.authenticatedUserRoles.map(r=>r.role+'@'+r.db),['readWrite@slacord']);
      }finally{await app.close();}
      for(const port of [3002,8082])await new Promise((resolve,reject)=>{const s=net.connect(port,'127.0.0.1');s.once('connect',()=>{s.destroy();reject(Error('Copied runtime unexpectedly active'));});s.once('error',e=>e.code==='ECONNREFUSED'?resolve():reject(e));});
      console.log(JSON.stringify({dbAuthentication:true,appRoleScoped:true,frontendSecretsRemoved:true,runtimeDisabled:true}));
    })().catch(()=>{console.error('Staged authentication verification failed; inspect privately.');process.exitCode=1;});
  `));
  checks.push(...Object.keys(db));
  console.log(JSON.stringify({ passed: checks.length, checks, productionUntouched: true }, null, 2));
  fs.writeFileSync(path.join(privateDir, 'security-verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, productionUntouched: true }, null, 2) + '\n', { mode: 0o600 });
} finally {
  docker(['exec', container, 'install', '-m', '600', '-o', 'gadoc', '-g', 'gadoc', '/run/gadoc-private/authorized/developer', '/home/gadoc/.ssh/authorized_keys']);
  fs.rmSync(temp, { recursive: true, force: true });
}
