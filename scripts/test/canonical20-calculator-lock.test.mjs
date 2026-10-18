import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

function raw(path){return readFileSync(new URL('../../'+path,import.meta.url));}
const known={
 'compact/canonical20/workloads.json':'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3',
 'compact/canonical20/cases/01-calculator-cli.json':'ec2a70c7108c5120bbffef22878290a885ecefb0',
 'compact/canonical20/programs/01-calculator-cli.hc':'3acfbc0be6f7902db7aee5dd46ecf0a8eb07a5a6',
 'compact/canonical20/programs/01-calculator-cli.ts':'6bb1ef9a47b77fa9429b560f66faf0e8ced64ca6'
};
test('first preregistered calculator workload and independent TS remain immutable',()=>{
 for(const [path,sha] of Object.entries(known)){
  const b=raw(path);
  assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha,path);
 }
 const reg=JSON.parse(raw('compact/canonical20/workloads.json'));
 const cases=JSON.parse(raw('compact/canonical20/cases/01-calculator-cli.json'));
 assert.equal(reg.workloads.length,20);
 assert.equal(reg.workloads[0].id,'01-calculator-cli');
 assert.equal(reg.workloads[0].acceptance,cases.acceptance);
 assert.equal(cases.positives.length,17);
 assert.equal(cases.negatives.length,15);
 assert.equal(raw('compact/canonical20/programs/01-calculator-cli.hc').toString('utf8'),'print(⩚⌨);\n');
 assert.match(raw('compact/canonical20/programs/01-calculator-cli.ts').toString('utf8'),/function evaluate\(/);
});
