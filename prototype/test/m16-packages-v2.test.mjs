import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {parse,linkProgram,execute} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';
import {validatePurePackageV2,contractType} from '../src/package-v2-types.mjs';

const root=resolve('.');
const lock=join(root,'hcode.m16.lock.json');
const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const prefix='use "vec.math@1.0.0" as vec;\n';
const out=(src,registry=loadLockedPackages(lock),options={})=>{
  const result=[];execute(src,{registry,stdout:value=>result.push(String(value)),...options});
  return result.join('\n');
};
function fixture(run){
  const dir=mkdtempSync(join(tmpdir(),'hcode-m16-js-'));
  try{
    mkdirSync(join(dir,'packages/vec.math'),{recursive:true});
    cpSync(join(root,'packages/vec.math'),join(dir,'packages/vec.math'),{recursive:true});
    const l=JSON.parse(readFileSync(lock,'utf8')),p=join(dir,'packages/vec.math');
    const save=()=>{
      l.packages[0].manifestSha256=SHA(readFileSync(join(p,'manifest.json')));
      l.packages[0].sourceSha256=SHA(readFileSync(join(p,'lib.hc')));
      writeFileSync(join(dir,'hcode.lock.json'),JSON.stringify(l));
    };
    save();
    const editManifest=fn=>{
      const m=JSON.parse(readFileSync(join(p,'manifest.json'),'utf8'));
      fn(m);writeFileSync(join(p,'manifest.json'),JSON.stringify(m));save();
    };
    const editSource=body=>{writeFileSync(join(p,'lib.hc'),body);save();};
    return run({dir,p,lock:join(dir,'hcode.lock.json'),load:()=>loadLockedPackages(join(dir,'hcode.lock.json')),editManifest,editSource});
  }finally{rmSync(dir,{force:true,recursive:true});}
}

test('M16 actual v2 SHA-locked package runs H-Code sign algorithms, not predefined outputs',()=>{
  const registry=loadLockedPackages(lock);
  assert.equal(registry.size,1);
  assert.equal(out(readFileSync(join(root,'examples/m16_vec_operations.hc'),'utf8'),registry),'10\n20');
  for(const [values,sum,doubled] of [
    ['⟦-5,9.5⟧','4.5','9.0'],['⟦0⟧','0','0'],['⟦4,6⟧','10','20'],['⟦⟧','0','0']
  ]){
    const program=prefix+'print(vec∷⊚('+values+'));print(∑vec∷⊛('+values+'));';
    assert.equal(out(program,registry),sum+'\n'+Number(doubled),program);
  }
  assert.equal(out(prefix+'≔ xs←⟦1,2,3⟧;≔ ys←vec∷⊛(xs);print(⌗xs);print(⌗ys);'), '3\n3');
});
test('M16 unsigned or incorrect recursive sequence contract calls fail before successful execution',()=>{
  const registry=loadLockedPackages(lock);
  for(const code of [
    prefix+'print(vec∷⊚(⟦"bad"⟧));',
    prefix+'print(vec∷⊚(⟦1,⊤⟧));',
    prefix+'print(vec∷⊚(42));',
    prefix+'print(vec∷⊚());',
    prefix+'print(vec∷⊛(⟦1⟧,⟦2⟧));'
  ])assert.throws(()=>out(code,registry),/expects|matching types|argument/,code);
  assert.throws(()=>out('print(⊚(⟦2,3⟧));',registry),/Unbound glyph/);
  assert.throws(()=>out('use "vec.math@9.0.0" as v;print(⊚(⟦1⟧));',registry),/not available/);
});
test('M16 source declarations, helper functions and return expressions are checked statically',()=>{
  fixture(f=>{
    f.editManifest(m=>m.operations[0].returns='String');
    assert.throws(()=>f.load(),/return type mismatch/);
  });
  fixture(f=>{
    f.editManifest(m=>m.operations[0].parameters[0].type='⟦String⟧');
    assert.throws(()=>f.load(),/parameter/);
  });
  for(const source of [
    'ƒ total(xs:⟦Number⟧)→Number ↩ "wrong";\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n',
    'ƒ total(xs:⟦Number⟧)→Number ↩ missing(xs);\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n',
    'ƒ total(xs:⟦Number⟧)→Number ↩ helper(xs);\nƒ helper(xs:⟦Number⟧)→Number ↩ print(xs);\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n',
    'ƒ total(xs:⟦Number⟧)→Number ↩ ⌗"bad";\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n',
    'ƒ total(xs:⟦Number⟧)→Number {⊢(⊤)⇒↩1}\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n',
    'use "demo.math@1.0.0" as math;\nƒ total(xs:⟦Number⟧)→Number ↩ ∑xs;\n',
  ]){
    fixture(f=>{f.editSource(source);assert.throws(()=>f.load(),/pure|Invalid H-Code package|top-level/,source);});
  }
});
test('M16 declared effects, unknown types, core glyphs and v1 sequence contracts are denied',()=>{
  fixture(f=>{f.editManifest(m=>m.operations[0].effects=['http.fetch']);assert.throws(()=>f.load(),/pure/);});
  fixture(f=>{f.editManifest(m=>m.operations[0].glyph='∑');assert.throws(()=>f.load(),/reserved core glyph/);});
  fixture(f=>{f.editManifest(m=>m.operations[0].parameters[0].type='⟦T⟧');assert.throws(()=>f.load(),/Unsupported/);});
  fixture(f=>{f.editManifest(m=>m.format=1);assert.throws(()=>f.load(),/invalid typed parameter/);});
  assert.equal(contractType('⟦⟦String⟧⟧'),'⟦⟦String⟧⟧');
  assert.throws(()=>contractType('⟦Any⟧'),/Unsupported/);
});
test('M16 exact SHA verifies both manifest and source *before* trusting typed H-Code code',()=>{
  fixture(f=>{
    assert.equal(f.load().size,1);
    writeFileSync(join(f.p,'lib.hc'),readFileSync(join(f.p,'lib.hc'),'utf8')+'// tampered\n');
    assert.throws(()=>f.load(),/source SHA-256 mismatch/);
  });
  fixture(f=>{
    writeFileSync(join(f.p,'manifest.json'),readFileSync(join(f.p,'manifest.json'),'utf8')+'\n');
    assert.throws(()=>f.load(),/manifest SHA-256 mismatch/);
  });
});
test('M16 typed nested user signs and two packages with the same glyph stay safely qualified',()=>{
  fixture(f=>{
    f.editSource('ƒ total(xs:⟦⟦Number⟧⟧)→Number ↩ ⌗xs;\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n');
    f.editManifest(m=>m.operations[0].parameters[0].type='⟦⟦Number⟧⟧');
    const r=f.load();
    assert.equal(out(prefix+'print(vec∷⊚(⟦⟦1⟧,⟦2,3⟧⟧));',r),'2');
    assert.throws(()=>out(prefix+'print(vec∷⊚(⟦⟦"bad"⟧⟧));',r),/expects/);
  });
  fixture(f=>{
    const dir=join(f.dir,'packages/vec.other');
    mkdirSync(dir);cpSync(join(f.p,'lib.hc'),join(dir,'lib.hc'));
    const man=JSON.parse(readFileSync(join(f.p,'manifest.json'),'utf8'));
    man.name='vec.other';
    writeFileSync(join(dir,'manifest.json'),JSON.stringify(man));
    const l=JSON.parse(readFileSync(f.lock,'utf8'));
    l.packages.push({name:'vec.other',version:'1.0.0',manifest:'packages/vec.other/manifest.json',
      manifestSha256:SHA(readFileSync(join(dir,'manifest.json'))),sourceSha256:SHA(readFileSync(join(dir,'lib.hc')))});
    writeFileSync(f.lock,JSON.stringify(l));
    const r=f.load(),uses=prefix+'use "vec.other@1.0.0" as o;\n';
    assert.throws(()=>out(uses+'print(⊚(⟦2,3⟧));',r),/Ambiguous glyph/);
    assert.equal(out(uses+'print(vec∷⊚(⟦2,3⟧));print(o∷⊚(⟦4,5⟧));',r),'5\n9');
  });
});
test('M16 package functions share reference execution-budget and cannot invoke ambient effects',()=>{
  const registry=loadLockedPackages(lock);
  assert.throws(()=>out(prefix+'print(vec∷⊚(⟦1,2,3⟧));',registry,{maxSteps:3}),/Execution step limit/);
  assert.throws(()=>out(prefix+'print(vec∷⊛(⟦1,2,3⟧));',registry,{maxSequenceItems:2}),/Sequence allocation limit/);
  fixture(f=>{
    f.editSource('ƒ total(xs:⟦Number⟧)→Number ↩ ∑xs;\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ process(xs);\n');
    assert.throws(()=>f.load(),/Unknown or effectful identifier/);
  });
});
