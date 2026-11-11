import {mkdir,open,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {Client,databaseUrl,pgEnvironment,command,fileHash,tableDigests} from './db-tools.mjs';
const url=databaseUrl(),target=resolve(process.env.BACKUP_OUTPUT??`.local/backups/fishing-${new Date().toISOString().replaceAll(':','-')}.dump`);
await mkdir(dirname(target),{recursive:true});const reservation=await open(target,'wx',0o600);await reservation.close();
const client=new Client({connectionString:url.toString()});
try{
  await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const {rows:[{snapshot}]}=await client.query('SELECT pg_export_snapshot() AS snapshot');
  const tables=await tableDigests(client);
  await command('pg_dump',['--format=custom','--no-owner','--no-acl',`--snapshot=${snapshot}`,`--file=${target}`],pgEnvironment(url));
  await client.query('COMMIT');
  const manifest={version:1,createdAt:new Date().toISOString(),database:decodeURIComponent(url.pathname.slice(1)),bytes:(await stat(target)).size,sha256:await fileHash(target),tables};
  await writeFile(target+'.manifest.json',JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({backup:target,tables:Object.keys(tables).length,bytes:manifest.bytes,sha256:manifest.sha256}));
}finally{await client.end();}
