import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../apps/server/package.json',import.meta.url));
const {Client,Query}=require('pg');
export {Client};
export function databaseUrl(){if(!process.env.DATABASE_URL&&!process.env.BACKUP_DATABASE_URL)process.loadEnvFile(fileURLToPath(new URL('../apps/server/.env',import.meta.url)));return new URL(process.env.BACKUP_DATABASE_URL??process.env.DATABASE_URL);}
export function pgEnvironment(url){return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),...(url.searchParams.has('sslmode')?{PGSSLMODE:url.searchParams.get('sslmode')}: {})};}
export function pgBinary(name){return process.env.PG_BIN?`${process.env.PG_BIN}/${name}${process.platform==='win32'?'.exe':''}`:name;}
export function command(name,args,env){return new Promise((resolve,reject)=>{const child=spawn(pgBinary(name),args,{env,stdio:['ignore','ignore','pipe'],windowsHide:true});let error='';child.stderr.on('data',chunk=>{error+=chunk.toString();});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${name} exited ${code}: ${error}`)));});}
export async function fileHash(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function tableDigests(client){
  await client.query("SET TIME ZONE 'UTC'");
  const {rows:tables}=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename COLLATE \"C\"");
  const result={};
  for(const {tablename} of tables){const hash=createHash('sha256');let count=0;const identifier='"'+tablename.replaceAll('"','""')+'"';
    await new Promise((resolve,reject)=>{const query=new Query(`SELECT row_to_json(t)::text AS row FROM public.${identifier} AS t ORDER BY row_to_json(t)::text COLLATE "C"`);query.on('row',row=>{hash.update(row.row+'\n');count++;});query.on('error',reject);query.on('end',resolve);client.query(query);});
    result[tablename]={count,sha256:hash.digest('hex')};
  }
  return result;
}
