// Symbol-first H-Code candidate must match the ORIGINAL SHA-frozen backend,
// independently written TypeScript, and the real disk-backed SQLite oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execute} from '../prototype/src/hcode.mjs';
import {seedDatabase} from './canonical20-db-oracle.ts';
import {queryDashboard} from '../compact/canonical20/idiomatic/15-db-dashboard-backend.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const paths=Object.freeze({
 original:'compact/canonical20/programs/15-db-dashboard-b2b.hc',
 candidate:'compact/canonical20/candidates/15-db-dashboard-sign-first.hc',
 front:'compact/canonical20/programs/15-db-dashboard-ui.hc',
 tsServer:'compact/canonical20/idiomatic/15-db-dashboard-backend.ts',
 tsBrowser:'compact/canonical20/idiomatic/15-db-dashboard-browser.ts'
});
const locked=Object.freeze({
 original:'096d248c3c6d42f7e430d7e53a6b191a3560e52f',
 candidate:'88ca9c491226a7c93894d728b04db6c472aea730',
 front:'ebfe4116989491cd28bc46ecdf56d910c4280773',
 tsServer:'6a38199524ce4b25a1476859d7817c6751006579',
 tsBrowser:'537236ac89b9eba6e4c9c188f33d1b34637ca1b0'
});
const read=path=>readFileSync(join(root,path),'utf8');
const metrics=kind=>{
 const bytes=readFileSync(join(root,paths[kind]));
 const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(sha,locked[kind],'Source lock changed for '+paths[kind]);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 return {chars:[...text].length,utf8Bytes:bytes.length,text};
};
const fixture=JSON.parse(read('compact/canonical20/cases/15-db-dashboard.json'));
function withDb(fn,rows=fixture.seed){
 const dir=mkdtempSync(join(tmpdir(),'hcode15-symbol-first-'));
 try{
   seedDatabase(join(dir,'orders.sqlite'),rows);
   return fn(dir);
 }finally{rmSync(dir,{recursive:true,force:true});}
}
function reference(source,dir,period){
 const stdout=[];
 execute(source,{dbHost:{query(name,sql,params){
   assert.equal(name,'orders.sqlite');
   const db=new DatabaseSync(join(dir,name),{readOnly:true,allowExtension:false});
   try{return db.prepare(sql).all(...params);}finally{db.close();}
 }},readStdin:()=>JSON.stringify({from:period.from,to:period.to}),stdout:line=>stdout.push(line)});
 assert.equal(stdout.length,1);
 return JSON.parse(stdout[0]);
}
function compile(rel,dir,name){
 const dest=join(dir,name+'.mjs');
 const built=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
   'build',join(root,rel),'--out',dest],{
   cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1048576
 });
 assert.equal(built.status,0,built.stderr||built.stdout||String(built.error));
 return dest;
}
function native(out,dir,period){
 const result=spawnSync(process.execPath,['--experimental-sqlite',out],{
   cwd:root,env:{...process.env,HCODE_SQLITE_READ_ROOT:dir},
   input:JSON.stringify({from:period.from,to:period.to}),
   encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1048576
 });
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
 return JSON.parse(result.stdout.trim());
}
const expected=period=>({byRegion:period.expected.byRegion,
  paidOrders:period.expected.paidOrders,revenueCents:period.expected.revenueCents});
test('source-locked candidate is shorter without rewriting M19.15 B3 original or TypeScript',()=>{
 const before=metrics('original'),after=metrics('candidate');
 const front=metrics('front'),tsServer=metrics('tsServer'),tsBrowser=metrics('tsBrowser');
 assert.ok(after.chars<before.chars*.7,'Sign-first reduction should exceed 30%');
 assert.ok(after.utf8Bytes<before.utf8Bytes);
 const hcodeChars=after.chars+front.chars,tsChars=tsServer.chars+tsBrowser.chars;
 const hcodeBytes=after.utf8Bytes+front.utf8Bytes,tsBytes=tsServer.utf8Bytes+tsBrowser.utf8Bytes;
 const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
 console.log('# HCODE15_SIGN_FIRST_SOURCE_SIZES '+JSON.stringify({
    originalBackend:{codepoints:before.chars,bytes:before.utf8Bytes},
    candidateBackend:{codepoints:after.chars,bytes:after.utf8Bytes},
    fullHCode:{codepoints:hcodeChars,bytes:hcodeBytes},
    idiomaticTypeScript:{codepoints:tsChars,bytes:tsBytes},
    backendBeforeAfterPct:pct(after.chars,before.chars),
    fullReductionVsTypeScriptCodepointsPct:pct(hcodeChars,tsChars),
    fullReductionVsTypeScriptBytesPct:pct(hcodeBytes,tsBytes),
    verifiedGlobal70Percent:false
 }));
});
test('five frozen real SQLite periods: sign-first H-Code, original H-Code, JS interpreter and idiomatic TS agree',()=>{
 withDb(dir=>{
  const originalSource=metrics('original').text,candidateSource=metrics('candidate').text;
  const original=compile(paths.original,dir,'old');
  const candidate=compile(paths.candidate,dir,'symbols');
  for(const period of fixture.cases){
    const oracle=expected(period);
    const js=reference(candidateSource,dir,period);
    assert.deepEqual(js,oracle,'JS reference '+period.id);
    assert.deepEqual(native(candidate,dir,period),oracle,'Rust sign-first '+period.id);
    assert.deepEqual(native(original,dir,period),oracle,'Rust source-locked original '+period.id);
    assert.deepEqual(reference(originalSource,dir,period),oracle,'Old interpreter '+period.id);
    assert.deepEqual(queryDashboard(join(dir,'orders.sqlite'),period.from,period.to),oracle,
      'Independent idiomatic TypeScript '+period.id);
  }
 });
});
test('sign-first generic sort is independent of SQLite row insertion order',()=>{
 for(const shift of [1,3,7,11]){
  const rows=fixture.seed.slice(shift).concat(fixture.seed.slice(0,shift));
  withDb(dir=>{
   for(const period of fixture.cases)
     assert.deepEqual(reference(metrics('candidate').text,dir,period),expected(period));
  },rows);
 }
});
