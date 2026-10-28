// Live rehearsal backup for the legacy source. Final cutover requires stopped writers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const source = 'ubuntu-slacord';
const base = path.join(os.homedir(), '.config/gadoc/backups');
const mode = process.argv[2];
function run(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
}
function privateJson(file, value, flag = 'wx') {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag });
}
function toFile(args, file, log) {
  const out = fs.openSync(file, 'wx', 0o600);
  const err = fs.openSync(log, 'a', 0o600);
  try {
    const result = spawnSync('docker', args, { stdio: ['ignore', out, err], timeout: 600000 });
    assert.equal(result.status, 0, 'Backup command failed; details are retained in the private log.');
  } finally { fs.closeSync(out); fs.closeSync(err); }
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const data of fs.createReadStream(file)) hash.update(data);
  return hash.digest('hex');
}
const inventoryScript = `
  const cp=require('child_process'),fs=require('fs'),crypto=require('crypto');
  const app=JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'})).find(a=>a.name==='slacord-backend');
  const mongoose=require(require.resolve('mongoose',{paths:[app.pm2_env.pm_cwd]}));
  (async()=>{const c=await mongoose.createConnection(app.pm2_env.env.MONGODB_URI).asPromise();try{
    const collections=[];
    for(const spec of (await c.db.listCollections().toArray()).sort((a,b)=>a.name.localeCompare(b.name))){
      if(spec.type!=='collection')continue;
      const col=c.db.collection(spec.name);
      collections.push({name:spec.name,count:await col.countDocuments(),indexes:await col.listIndexes().toArray()});
    }
    console.log(JSON.stringify({database:c.name,collections}));
  }finally{await c.close();}})().catch(()=>{console.error('Database inventory failed.');process.exitCode=1;});
`;
async function capture() {
  const space = fs.statfsSync(os.homedir());
  assert.ok(space.bavail * space.bsize >= 15 * 1024 ** 3, 'At least 15 GiB free is required.');
  const inspected = JSON.parse(run(['inspect', source]))[0];
  assert.equal(inspected.State.Running, true);
  assert.ok(inspected.Mounts.some(m => m.Name === 'kscold-control_slacord-mongo-data' && m.Destination === '/data/db'));
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(base, 'instance-'));
  fs.chmodSync(directory, 0o700);
  const log = path.join(directory, 'backup-private.log');
  privateJson(path.join(directory, 'container.inspect.json'), inspected);
  const success = JSON.parse(run(['exec', source, 'cat', '/app/slacord-deploy/last-success.json']));
  const inventory = JSON.parse(run(['exec', source, 'node', '-e', inventoryScript]));
  privateJson(path.join(directory, 'database.inventory.json'), inventory);
  toFile(['exec', source, 'pm2', 'jlist'], path.join(directory, 'pm2.json'), log);
  const configName = `/run/gadoc-backup-${randomBytes(8).toString('hex')}.yaml`;
  const dumpScript = `
    const fs=require('fs'),cp=require('child_process');const file=${JSON.stringify(configName)};
    const u=encodeURIComponent(process.env.MONGO_ROOT_USERNAME||''),p=encodeURIComponent(process.env.MONGO_ROOT_PASSWORD||'');
    if(!u||!p)throw Error('Root backup authentication is not configured.');
    fs.writeFileSync(file,'uri: '+JSON.stringify('mongodb://'+u+':'+p+'@127.0.0.1:27017/?authSource=admin')+'\\n',{mode:0o600,flag:'wx'});
    try{const r=cp.spawnSync('mongodump',['--config',file,'--archive','--gzip'],{stdio:'inherit'});process.exitCode=r.status??1;}
    finally{fs.unlinkSync(file);}
  `;
  toFile(['exec', source, 'node', '-e', dumpScript], path.join(directory, 'mongodb.archive.gz'), log);
  await pipeline(fs.createReadStream(path.join(directory, 'mongodb.archive.gz')), createGunzip(), new Writable({ write(_chunk, _encoding, done) { done(); } }));
  toFile(['exec', '--workdir', '/', source, 'flock', '-s', '/app/slacord-deploy/deploy.lock', 'sh', '-c',
    'tar -czf - -C / app/slacord-deploy root/.pm2/dump.pm2 root/.ssh etc/ssh/ssh_host_* etc/ssh/sshd_config etc/ssh/sshd_config.d'],
    path.join(directory, 'runtime-and-ssh.tar.gz'), log);
  const after = JSON.parse(run(['exec', source, 'cat', '/app/slacord-deploy/last-success.json']));
  assert.equal(after.revision, success.revision, 'Deployment changed during capture; keep this backup but capture another.');
  await seal(directory, inspected, success, inventory);
}
async function seal(directory, inspected, success, inventory) {
  const control = fileURLToPath(new URL('../../', import.meta.url));
  for (const [relative, name] of [['docker-compose.yml','control-compose.yml'],['nginx/conf.d/slacord.conf','nginx-slacord.conf']]) {
    fs.copyFileSync(path.join(control, relative), path.join(directory, name), fs.constants.COPYFILE_EXCL);
    fs.chmodSync(path.join(directory, name), 0o600);
  }
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    if (name === 'backup-private.log') continue;
    const file = path.join(directory, name);
    files.push({ name, bytes: fs.statSync(file).size, sha256: await digest(file) });
  }
  privateJson(path.join(directory, 'manifest.json'), {
    sourceContainer: source, sourceContainerId: inspected.Id, sourceVolume: 'kscold-control_slacord-mongo-data',
    revision: success.revision, createdAt: new Date().toISOString(),
    consistency: 'Live rehearsal backup; final cutover requires stopped writers and a new consistent backup.',
    files,
  });
  console.log(JSON.stringify({ backup: directory, revision: success.revision, collections: inventory.collections.length, files: files.map(({name,bytes})=>({name,bytes})) }, null, 2));
}
async function restore() {
  const directory = fs.realpathSync(process.argv[3]);
  assert.equal(path.dirname(directory), fs.realpathSync(base));
  assert.match(path.basename(directory), /^(?:\d{8}-)?instance-[\w-]+$/);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  for (const entry of manifest.files) assert.equal(await digest(path.join(directory, entry.name)), entry.sha256, `Checksum mismatch: ${entry.name}`);
  const suffix = randomBytes(6).toString('hex');
  const name = `gadoc-restore-verify-${suffix}`;
  const volume = `${name}-data`;
  const log = path.join(directory, 'restore-private.log');
  run(['volume', 'create', '--label', 'gadoc.migration-purpose=restore-verification', volume]);
  let created = false;
  try {
    run(['run', '-d', '--name', name, '--network', 'none', '--label', 'gadoc.migration-purpose=restore-verification',
      '--mount', `type=volume,src=${volume},dst=/data/db`, '--mount', `type=bind,src=${directory},dst=/backup,readonly`,
      '--entrypoint', 'mongod', 'kscold/ubuntu-slacord:latest', '--dbpath', '/data/db', '--bind_ip', '127.0.0.1', '--port', '27017', '--noauth']);
    created = true;
    let ready = false;
    for (let attempt=0;attempt<40;attempt++) {
      const probe=spawnSync('docker',['exec',name,'mongosh','--quiet','--eval','quit(db.adminCommand({ping:1}).ok ? 0 : 1)'],{stdio:'ignore'});
      if(probe.status===0){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert.ok(ready, 'Restore-only MongoDB did not become ready.');
    toFile(['exec',name,'mongorestore','--archive=/backup/mongodb.archive.gz','--gzip','--stopOnError'],path.join(directory,`restore-output-${suffix}.log`),log);
    const expected=JSON.parse(fs.readFileSync(path.join(directory,'database.inventory.json'),'utf8'));
    const script=`const d=db.getSiblingDB(${JSON.stringify(expected.database)});print(JSON.stringify({version:db.version(),collections:d.getCollectionInfos({type:'collection'}).map(c=>({name:c.name,count:d.getCollection(c.name).countDocuments(),indexes:d.getCollection(c.name).getIndexes()})),users:db.getSiblingDB('admin').system.users.countDocuments()}));`;
    const restored=JSON.parse(run(['exec',name,'mongosh','--quiet','--eval',script]));
    assert.equal(restored.version, '7.0.31');
    assert.ok(restored.users >= 2, 'Database users and roles were not restored.');
    assert.deepEqual(restored.collections.map(c=>c.name).sort(), expected.collections.map(c=>c.name).sort(), 'Collection inventory mismatch.');
    const differences=[];
    for(const c of expected.collections){
      const actual=restored.collections.find(x=>x.name===c.name);
      assert.ok(actual, `Missing collection ${c.name}`);
      if(actual.count!==c.count)differences.push(c.name);
      const byName=(a,b)=>a.name.localeCompare(b.name);
      const actualIndexes=actual.indexes.toSorted(byName), expectedIndexes=c.indexes.toSorted(byName);
      assert.deepEqual(actualIndexes,expectedIndexes,`Index mismatch in ${c.name}`);
      for(let i=0;i<actualIndexes.length;i++)assert.deepEqual(Object.entries(actualIndexes[i].key),Object.entries(expectedIndexes[i].key),`Compound index key order mismatch in ${c.name}`);
    }
    privateJson(path.join(directory,'restore-verification.json'),{verifiedAt:new Date().toISOString(),version:restored.version,collections:restored.collections.length,users:restored.users,countChangesDuringLiveCapture:differences,network:'none',sourceUntouched:true},'w');
    console.log(JSON.stringify({restored:true,version:restored.version,collections:restored.collections.length,users:restored.users,countChangesDuringLiveCapture:differences,backup:directory},null,2));
  } finally {
    if(created){run(['stop','--time','30',name]);run(['rm',name]);}
    run(['volume','rm',volume]);
  }
}
try {
  if(mode==='capture')await capture();
  else if(mode==='restore-check')await restore();
  else throw Error('Choose capture or restore-check.');
} catch(error) {console.error(error.message);process.exitCode=1;}
