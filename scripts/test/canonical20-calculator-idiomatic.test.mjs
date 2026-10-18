import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url);
const fixture={
 'compact/canonical20/workloads.json':'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3',
 'compact/canonical20/cases/01-calculator-cli.json':'ec2a70c7108c5120bbffef22878290a885ecefb0',
 'compact/canonical20/programs/01-calculator-cli.hc':'3acfbc0be6f7902db7aee5dd46ecf0a8eb07a5a6',
 'compact/canonical20/programs/01-calculator-cli.ts':'6bb1ef9a47b77fa9429b560f66faf0e8ced64ca6',
 'compact/canonical20/baselines/01-idiomatic-typescript/package.json':'1f18d3c72aa7f5c30b0aaa7fdebe941f814729ef',
 'compact/canonical20/baselines/01-idiomatic-typescript/package-lock.json':'cf3d71a3eb58ffb60ae4d525624219a0598166ad',
 'compact/canonical20/baselines/01-idiomatic-typescript/program.ts':'175320b2f535acdbf4ced0b6dfe928b0351f627c'
};
const file=path=>readFileSync(new URL(path,root));
test('all source, registry, acceptance and idiomatic math baseline SHA locks resist benchmark drift',()=>{
  for(const [name,sha] of Object.entries(fixture)){
    const bytes=file(name),actual=createHash('sha1')
      .update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(actual,sha,'Git blob SHA changed: '+name);
  }
  const hc=file('compact/canonical20/programs/01-calculator-cli.hc').toString('utf8');
  const ts=file('compact/canonical20/baselines/01-idiomatic-typescript/program.ts').toString('utf8');
  assert.equal(hc,'print(⩚⌨);\n');
  assert.equal([...hc].length,11);
  assert.equal(Buffer.byteLength(hc),15);
  assert.equal([...ts].length,2786);
  assert.equal(Buffer.byteLength(ts),2786);
  assert.match(ts,/from "@expr-eval\/js"/);
  assert.match(ts,/\.parse\(input\)\.evaluate/);
  assert.doesNotMatch(ts,/toJSFunction|new Function|eval\(/);
});
test('isolated maintained-library dependency is registry-version and SRI-locked',()=>{
 const base='compact/canonical20/baselines/01-idiomatic-typescript/';
 const pkg=JSON.parse(file(base+'package.json'));
 const lock=JSON.parse(file(base+'package-lock.json'));
 assert.deepEqual(pkg.dependencies,{'@expr-eval/js':'3.7.0'});
 assert.equal(lock.lockfileVersion,3);
 assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
 assert.deepEqual(Object.keys(lock.packages).sort(),['','node_modules/@expr-eval/js'].sort());
 assert.equal(lock.packages['node_modules/@expr-eval/js'].version,'3.7.0');
 assert.equal(lock.packages['node_modules/@expr-eval/js'].integrity,
   'sha512-bt6N4klnRt6sfhVSI1TyM5fO0l9xIV5ofXpuk2a/GlpgyHZkkUiUSYNMf3FURABCWPbehlHWzvqX35teSgA1TA==');
 assert.equal(lock.packages['node_modules/@expr-eval/js'].resolved,
   'https://registry.npmjs.org/@expr-eval/js/-/js-3.7.0.tgz');
 const mainPkg=JSON.parse(file('package.json'));
 assert.equal(mainPkg.dependencies?.['@expr-eval/js'],undefined);
});
