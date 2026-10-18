// M19.12 B4: exact-blob-locked source accounting.
// TypeScript here is the correctness ORACLE, not a competitive idiomatic
// alternative. Never publish this oracle comparison as a 70%-goal result.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const FILES={
 hcode:['compact/canonical20/programs/12-crud-api.hc','b3ba6542ef27474390a7354c8c01a22464156179'],
 tsOracle:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e'],
 cases:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76'],
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3']
};
const root=new URL('../',import.meta.url);
function locked(label){
 const [path,sha]=FILES[label];
 const bytes=readFileSync(new URL(path,root));
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(actual,sha,'Canonical12 source drift: '+path);
 return bytes;
}
export function measure12(){
 const hc=locked('hcode'),ts=locked('tsOracle');
 const cases=JSON.parse(locked('cases')),registry=JSON.parse(locked('registry'));
 assert.equal(cases.cases.length,6);
 assert.equal(registry.workloads.length,20);
 assert.equal(registry.workloads[11].id,'12-crud-api');
 const hcText=new TextDecoder('utf-8',{fatal:true}).decode(hc);
 const tsText=new TextDecoder('utf-8',{fatal:true}).decode(ts);
 const hcCodepoints=Array.from(hcText).length;
 const tsCodepoints=Array.from(tsText).length;
 return {
  task:'12-crud-api',
  sourceLocks:{hcode:FILES.hcode[1],tsCorrectnessOracle:FILES.tsOracle[1]},
  authoredSource:{
   hcode:{unicodeCodepoints:hcCodepoints,utf8Bytes:hc.length},
   typescriptCorrectnessOracle:{unicodeCodepoints:tsCodepoints,utf8Bytes:ts.length}
  },
  provisionalCorrectnessOracleOnly:{
   codepointReductionPct:Number((100*(1-hcCodepoints/tsCodepoints)).toFixed(2)),
   utf8ByteReductionPct:Number((100*(1-hc.length/ts.length)).toFixed(2))
  },
  validCompetitiveIdiomaticTypeScriptBaseline:false,
  globallyVerified70Percent:false
 };
}
test('B4: exact source metrics must never become a false global compression claim',()=>{
 const m=measure12();
 assert.ok(m.authoredSource.hcode.unicodeCodepoints>0);
 assert.ok(m.authoredSource.typescriptCorrectnessOracle.unicodeCodepoints>0);
 assert.equal(m.authoredSource.hcode.unicodeCodepoints,3098);
 assert.equal(m.authoredSource.hcode.utf8Bytes,3721);
 assert.equal(m.authoredSource.typescriptCorrectnessOracle.unicodeCodepoints,8772);
 assert.equal(m.authoredSource.typescriptCorrectnessOracle.utf8Bytes,8772);
 assert.equal(m.validCompetitiveIdiomaticTypeScriptBaseline,false);
 assert.equal(m.globallyVerified70Percent,false);
});
if(process.argv.includes('--report'))console.log(JSON.stringify(measure12(),null,2));
