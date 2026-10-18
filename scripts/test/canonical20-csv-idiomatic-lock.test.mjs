import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const frozen={
 'compact/canonical20/workloads.json':'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3',
 'compact/canonical20/programs/04-csv-validation.hc':'ab7c4a8059244339318d31bd553dfebe463fab4f',
 'compact/canonical20/programs/04-csv-validation.ts':'27b3b2f2ecbca43d33341463096a1ceff79347c8',
 'compact/canonical20/cases/04-csv-validation.json':'0a0381b403da2c5701767bf82912b10a58012535',
 'compact/canonical20/baselines/04-idiomatic-typescript/package.json':'3148dce11c4bd23e35f17fdcc4fc3513c0bde3d3',
 'compact/canonical20/baselines/04-idiomatic-typescript/package-lock.json':'f83bcbf150d070ae483398979af8750d365a9959',
 'compact/canonical20/baselines/04-idiomatic-typescript/reader.ts':'c4e4ef98b7d289f6d96f1e74c0c242f568f33c18',
 'compact/canonical20/baselines/04-idiomatic-typescript/program.ts':'b0d8412b1f102707d905f06b546fc8c8dcd4b056'
};
function file(name){return readFileSync(new URL('../../'+name,import.meta.url));}
test('canonical task04 and new idiomatic maintained-TS comparison preserve exact authored source snapshots',()=>{
 for(const [name,expected] of Object.entries(frozen)){
   const b=file(name);
   const sha=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
   assert.equal(sha,expected,name);
 }
 const hc=file('compact/canonical20/programs/04-csv-validation.hc').toString('utf8');
 const base='compact/canonical20/baselines/04-idiomatic-typescript/';
 const ts=[file(base+'reader.ts').toString('utf8'),file(base+'program.ts').toString('utf8')];
 assert.equal([...hc].length,258);
 assert.equal(Buffer.byteLength(hc),273);
 assert.equal(ts.reduce((n,s)=>n+[...s].length,0),3362);
 assert.equal(ts.reduce((n,s)=>n+Buffer.byteLength(s),0),3362);
 assert.match(ts[0],/from "csv-parse\/sync"/);
 assert.match(ts[0],/from "zod"/);
 assert.match(ts[0],/readUsers/);
 assert.equal((ts[1].match(/console\.log\(/g)||[]).length,4);
});
test('both maintained TS dependencies are exact and integrity-locked and do not leak into root package',()=>{
 const base='compact/canonical20/baselines/04-idiomatic-typescript/';
 const p=JSON.parse(file(base+'package.json')),l=JSON.parse(file(base+'package-lock.json'));
 assert.deepEqual(p.dependencies,{'csv-parse':'7.0.2',zod:'4.6.5'});
 assert.equal(l.lockfileVersion,3);
 assert.deepEqual(l.packages[''].dependencies,p.dependencies);
 assert.deepEqual(Object.keys(l.packages).sort(),
   ['', 'node_modules/csv-parse','node_modules/zod'].sort());
 for(const [name,version] of Object.entries(p.dependencies)){
   assert.equal(l.packages['node_modules/'+name].version,version);
   assert.match(l.packages['node_modules/'+name].integrity,/^sha512-[A-Za-z0-9+/=]+$/);
 }
 assert.equal(l.packages['node_modules/csv-parse'].integrity,
   'sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA==');
 assert.equal(l.packages['node_modules/zod'].integrity,
   'sha512-v5l/aFXZQeai4awLbOpSoHecE9UiMrnfx75tEXLjNonXVARxQ5mOeipTjROUchszUNCqnE+hqAMujRsRHsut2Q==');
 const rootPkg=JSON.parse(file('package.json'));
 assert.equal(rootPkg.dependencies?.['csv-parse'],undefined);
 assert.equal(rootPkg.dependencies?.zod,undefined);
});
