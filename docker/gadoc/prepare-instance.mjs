// Rehearsal only: never stops the source container or enables the copied app.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const [backupArg, privateArg, repositoryArg] = process.argv.slice(2);
assert.ok(backupArg && privateArg && repositoryArg, 'Usage: node prepare-instance.mjs BACKUP PRIVATE_DIR GADOC_REPOSITORY');
const backup = fs.realpathSync(backupArg);
const privateDir = path.resolve(privateArg);
const repository = fs.realpathSync(repositoryArg);
const image = 'kscold/ubuntu-gadoc:2026-10-28-r1';
const volumes = ['gadoc-mongo-data', 'gadoc-app-data', 'gadoc-developer-home', 'gadoc-pm2-data'];
const label = 'gadoc.migration-purpose=staged-instance';
const helper = `gadoc-prepare-${randomBytes(6).toString('hex')}`;
const docker = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
const save = (file, data) => fs.writeFileSync(file, data, { mode: 0o600, flag: 'wx' });
const exists = (type, name) => spawnSync('docker', [type, 'inspect', name], { stdio: 'ignore' }).status === 0;
const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8'));
const checked = JSON.parse(fs.readFileSync(path.join(backup, 'restore-verification.json'), 'utf8'));
assert.equal(checked.sourceUntouched, true);
assert.equal(checked.version, '7.0.31');
assert.equal(manifest.sourceContainer, 'ubuntu-slacord');
assert.equal(JSON.parse(docker(['inspect', manifest.sourceContainer]))[0].State.Running, true);
assert.ok(!exists('container', 'ubuntu-gadoc'), 'Candidate already exists; inspect it rather than overwriting.');
for (const name of volumes) assert.ok(!exists('volume', name), `Volume already exists: ${name}; never overwrite.`);
assert.ok(!fs.existsSync(privateDir), 'Private destination already exists; never overwrite.');
assert.ok(!(fs.statSync(backup).mode & 0o077), 'Backup directory must be private.');
const freeKiB = Number(execFileSync('df', ['-k', os.homedir()], { encoding: 'utf8' }).trim().split('\n').at(-1).trim().split(/\s+/)[3]);
assert.ok(freeKiB >= 15 * 1024 * 1024, 'At least 15 GiB of host free space is required.');
for (const entry of manifest.files) {
  assert.equal(path.basename(entry.name), entry.name);
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(path.join(backup, entry.name))) hash.update(chunk);
  assert.equal(hash.digest('hex'), entry.sha256, `Backup checksum mismatch: ${entry.name}`);
}
const archive = path.join(backup, 'runtime-and-ssh.tar.gz');
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim().split('\n');
assert.ok(entries.every((entry) => !entry.startsWith('/') && !entry.split('/').includes('..')), 'Unsafe backup path.');
const deployKey = fs.readFileSync(path.join(os.homedir(), '.ssh/slacord-actions-deploy.pub'), 'utf8').trim();
const previousKeys = execFileSync('tar', ['-xOzf', archive, 'root/.ssh/authorized_keys'], { encoding: 'utf8' });
assert.ok(previousKeys.includes(deployKey.split(/\s+/)[1]), 'Deployment key differs from the source.');
const developerKeys = fs.readFileSync(path.join(os.homedir(), '.ssh/authorized_keys'), 'utf8').trim();
assert.ok(developerKeys && developerKeys.split('\n').every((line) => /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+) /.test(line)), 'Review developer keys before migration.');

fs.mkdirSync(privateDir, { mode: 0o700 });
for (const name of ['hostkeys', 'authorized']) fs.mkdirSync(path.join(privateDir, name), { mode: 0o700 });
const hostArchive = fs.existsSync(path.join(backup, 'ssh-host-keys.tar.gz')) ? path.join(backup, 'ssh-host-keys.tar.gz') : archive;
for (const name of ['ssh_host_ed25519_key', 'ssh_host_ed25519_key.pub', 'ssh_host_rsa_key', 'ssh_host_rsa_key.pub']) {
  save(path.join(privateDir, 'hostkeys', name), execFileSync('tar', ['-xOzf', hostArchive, `etc/ssh/${name}`]));
}
save(path.join(privateDir, 'authorized/root'), `restrict,command="/app/slacord-deploy/tools/ssh-entrypoint.sh" ${deployKey}\n`);
save(path.join(privateDir, 'authorized/developer'), `${developerKeys}\n`);
save(path.join(privateDir, 'candidate.env'), `GADOC_PRIVATE_DIR=${privateDir}\nGADOC_START_RUNTIME=0\nGADOC_SSH_BIND=127.0.0.1\nGADOC_SSH_PORT=2228\n`);
for (const name of volumes) docker(['volume', 'create', '--label', label, name]);
let created = false;
try {
  docker(['run', '-d', '--name', helper, '--network', 'none', '--label', label,
    '--mount', 'type=volume,src=gadoc-mongo-data,dst=/data/db',
    '--mount', 'type=volume,src=gadoc-app-data,dst=/app',
    '--mount', `type=bind,src=${backup},dst=/backup,readonly`,
    '--mount', `type=bind,src=${repository}/scripts/deploy,dst=/deployment-tools,readonly`,
    '--entrypoint', 'mongod', image, '--dbpath', '/data/db', '--bind_ip', '127.0.0.1', '--noauth']);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnSync('docker', ['exec', helper, 'mongosh', '--quiet', '--eval', 'quit(db.adminCommand({ping:1}).ok ? 0 : 1)'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Restore helper did not become ready.');
  const log = fs.openSync(path.join(privateDir, 'restore-private.log'), 'wx', 0o600);
  try {
    const result = spawnSync('docker', ['exec', helper, 'mongorestore', '--archive=/backup/mongodb.archive.gz', '--gzip', '--stopOnError'], { stdio: ['ignore', log, log] });
    assert.equal(result.status, 0, 'Restore failed; inspect the private log.');
  } finally { fs.closeSync(log); }
  docker(['exec', helper, 'tar', '-xzf', '/backup/runtime-and-ssh.tar.gz', '-C', '/', 'app/slacord-deploy']);
  const result = docker(['exec', '-i', helper, 'node', '--input-type=module'], { input: `
    import fs from 'node:fs';
    import assert from 'node:assert/strict';
    import {execFileSync} from 'node:child_process';
    import {releaseApps, prepareRuntimePaths} from '/deployment-tools/deploy-ubuntu.mjs';
    const state='/app/slacord-deploy';
    const expected=JSON.parse(fs.readFileSync('/backup/database.inventory.json'));
    const inventory=JSON.parse(execFileSync('mongosh',['--quiet','--eval',
      'const d=db.getSiblingDB('+JSON.stringify(expected.database)+');print(JSON.stringify({version:db.version(),users:db.getSiblingDB("admin").system.users.countDocuments(),collections:d.getCollectionInfos({type:"collection"}).map(c=>({name:c.name,count:d.getCollection(c.name).countDocuments(),indexes:d.getCollection(c.name).getIndexes()}))}));'],{encoding:'utf8'}));
    assert.equal(inventory.version,'7.0.31');assert.ok(inventory.users>=2);
    assert.deepEqual(inventory.collections.map(c=>c.name).sort(),expected.collections.map(c=>c.name).sort());
    for(const c of expected.collections){const actual=inventory.collections.find(a=>a.name===c.name);assert.equal(actual.count,c.count);
      const a=actual.indexes.toSorted((a,b)=>a.name.localeCompare(b.name)),b=c.indexes.toSorted((a,b)=>a.name.localeCompare(b.name));
      assert.deepEqual(a,b);a.forEach((index,i)=>assert.deepEqual(Object.entries(index.key),Object.entries(b[i].key)));}
    const previous=JSON.parse(fs.readFileSync('/backup/pm2.json'));
    const apps=['slacord-backend','slacord-frontend'].map((name,i)=>{const app=previous.find(a=>a.name===name);app.pm2_env.uid=1002+i;app.pm2_env.gid=1002+i;return app;});
    const release=fs.realpathSync(state+'/current');
    const config=releaseApps(release,apps,'https://slacord.cloud');
    for(const app of config.apps){app.interpreter='/usr/local/bin/node';delete app.env.HOME;delete app.env.PM2_HOME;}
    config.apps[0].env.COOKIE_SECURE='true';
    prepareRuntimePaths(release,config);
    fs.writeFileSync(release+'/ecosystem.config.json',JSON.stringify(config,null,2)+'\\n',{mode:0o600});
    fs.chmodSync(release+'/ecosystem.config.json',0o600);
    fs.mkdirSync(state+'/tools',{recursive:true,mode:0o700});fs.chmodSync(state+'/tools',0o700);
    for(const name of ['deploy-ubuntu.mjs','ssh-entrypoint.sh']){fs.copyFileSync('/deployment-tools/'+name,state+'/tools/'+name);fs.chmodSync(state+'/tools/'+name,0o700);}
    fs.mkdirSync(state+'/private',{recursive:true,mode:0o700});fs.chmodSync(state+'/private',0o700);
    assert.ok(!fs.existsSync(state+'/private/migration-verified.json'),'A rehearsal must not contain activation approval.');
    const verification={stage:'rehearsal-only',version:inventory.version,collections:inventory.collections.length,users:inventory.users,revision:${JSON.stringify(manifest.revision)},checkedAt:new Date().toISOString()};
    fs.writeFileSync(state+'/private/rehearsal-verified.json',JSON.stringify(verification,null,2)+'\\n',{mode:0o600});
    console.log(JSON.stringify(verification));
  ` });
  const verification = JSON.parse(result.trim());
  save(path.join(privateDir, 'rehearsal-verified.json'), JSON.stringify({ ...verification, backup, sourceUntouched: true }, null, 2) + '\n');
  console.log(JSON.stringify({ ...verification, privateDir, volumes, runtimeEnabled: false }, null, 2));
} finally {
  if (created) { docker(['stop', '--time', '45', helper]); docker(['rm', helper]); }
  // Never remove copied volumes here, including on failure: retain them for diagnosis.
}
