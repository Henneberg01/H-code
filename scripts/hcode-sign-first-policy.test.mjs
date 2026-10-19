// H-Code sign-first regression guard. No rewriting or cherry-picking frozen tasks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
const gitBlob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const points=s=>[...s].length;
const primary='compact/canonical20/programs/15-db-symbol-first-b1.hc';
const competitor='compact/canonical20/idiomatic/15-db-table-symbol-first.ts';

test('original twenty preregistered tasks remain unchanged and count unsupported cases',()=>{
 const actual=read('compact/canonical20/workloads.json');
 assert.equal(gitBlob(actual),'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3');
 const entries=JSON.parse(actual).workloads;
 assert.equal(entries.length,20);
 assert.equal(entries[14].id,'15-db-dashboard');
 assert.equal(entries[14].status,'unsupported','B1 syntax is NOT a finished dashboard');
});

test('primary H-Code database source leads with meaningful real signs, not English aliases or pasted SQL',()=>{
 const hc=read(primary);
 for(const sign of ['≔','⧈','⌕','⇢','λ','·','⤒'])
   assert.ok(hc.includes(sign),'Missing a meaningful source sign '+sign);
 assert.doesNotMatch(hc,/\b(?:db_rows|dom_table|SELECT|FROM|GROUP BY|ORDER BY|function|const|let|return)\b/i);
 assert.equal(gitBlob(hc),'730daae69d80bbfb52200c056d368161600518ac');
 assert.ok(read('H-CODE-PRINCIPLES.md').includes('OWNER DIRECTION: HOLD DIG TIL TEGN'));
});

test('paired source sizes include comments and real Unicode bytes without claiming global success',()=>{
 const hc=read(primary),ts=read(competitor);
 assert.equal(gitBlob(ts),'f753b7ec77bf5aff06025a618ef4a5df6e8a3451');
 const pointReduction=100*(1-points(hc)/points(ts));
 const byteReduction=100*(1-Buffer.byteLength(hc)/Buffer.byteLength(ts));
 assert.ok(pointReduction>0);
 assert.ok(Number.isFinite(byteReduction));
 console.log(JSON.stringify({task:'typed-table-scan-and-transform-ONLY',
   hcodeCodePoints:points(hc),typescriptCodePoints:points(ts),
   unicodePointReduction:Number(pointReduction.toFixed(2)),
   hcodeBytes:Buffer.byteLength(hc),typescriptBytes:Buffer.byteLength(ts),
   byteReduction:Number(byteReduction.toFixed(2)),global70PercentProven:false}));
});

test('existing canonical programs and historical source remain present, not rewritten for benchmark gains',()=>{
 const files=readdirSync(join(root,'compact/canonical20/programs')).filter(x=>x.endsWith('.hc'));
 for(const task of ['01-calculator-cli','03-text-frequency-counter','04-csv-validation',
   '05-json-transformation','06-http-retries','07-file-conversion','08-concurrent-requests',
   '09-expiring-cache','10-generic-collection-transforms','11-markdown-processing',
   '12-crud-api','13-form-validation-ui','14-todo-app']){
   const path=files.find(f=>f===task+'.hc');
   assert.ok(path,'Missing canonical historical workload '+task);
 }
 assert.ok(files.includes('15-db-query-b1.hc'),'Keep low-level SQL compatibility candidate');
});
