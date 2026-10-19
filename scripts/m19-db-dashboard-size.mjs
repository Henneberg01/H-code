// M19.15 B3: source-locked, fairly labelled developer-authored size measurements.
// Correctness must be independently verified before a result can count as 15/20.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const locks=new Map([
 ['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 ['compact/canonical20/cases/15-db-dashboard.json','184266b6e49cb8e328e868e6ebc3f1a9bec78b58'],
 ['scripts/canonical20-db-oracle.ts','82654f315c7d967228f5a0670b28265a185822b6'],
 ['compact/canonical20/programs/15-db-dashboard-b2b.hc','b26fe472f75d844231c2cb1b4353be5f81970174'],
 ['compact/canonical20/programs/15-db-dashboard-ui.hc','ebfe4116989491cd28bc46ecdf56d910c4280773'],
 ['compact/canonical20/idiomatic/15-db-dashboard-backend.ts','6a38199524ce4b25a1476859d7817c6751006579'],
 ['compact/canonical20/idiomatic/15-db-dashboard-browser.ts','537236ac89b9eba6e4c9c188f33d1b34637ca1b0']
]);
const group={
 hcode:['compact/canonical20/programs/15-db-dashboard-b2b.hc',
        'compact/canonical20/programs/15-db-dashboard-ui.hc'],
 typescript:['compact/canonical20/idiomatic/15-db-dashboard-backend.ts',
             'compact/canonical20/idiomatic/15-db-dashboard-browser.ts']
};
function gitBlob(bytes){
 return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
const measurements={};
for(const [path,hash] of locks){
 const bytes=readFileSync(join(root,path));
 const actual=gitBlob(bytes);
 if(actual!==hash)throw Error('Canonical15 source-lock mismatch: '+path+' '+actual+' vs '+hash);
 measurements[path]={
  codepoints:[...new TextDecoder('utf-8',{fatal:true}).decode(bytes)].length,
  utf8Bytes:bytes.length
 };
}
const sum=(groupName,key)=>group[groupName].reduce((n,p)=>n+measurements[p][key],0);
const hc=sum('hcode','codepoints'),ts=sum('typescript','codepoints');
const result={
 phase:'provisional size comparison; correctness, CI and browser proof required before 15/20',
 codepoints:{hcode:hc,idiomaticTypeScript:ts,reductionPercent:Math.round(10000*(1-hc/ts))/100},
 utf8Bytes:{hcode:sum('hcode','utf8Bytes'),idiomaticTypeScript:sum('typescript','utf8Bytes')},
 sources:measurements,
 excludedFromDeveloperSourceMetric:['compiler/runtime implementation and Node SQLite dependency',
 'CI and test harness code, generated ESM, HTML shell/CSS and common host infrastructure'],
 caveat:'All exclusions must be consistently disclosed; this is not a claimed global >=70% median.'
};
console.log(JSON.stringify(result,null,2));
