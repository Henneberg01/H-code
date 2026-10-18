import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parse,tokenize,execute,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';
import {normalizeBinders,specializeCall,checkSpecializedReturn} from '../src/package-v3-signatures.mjs';

const root=resolve('.');
const lock=join(root,'hcode.m16.2.lock.json');
const uses='use "poly.signs@1.0.0" as poly;\n';
const stdout=(program,registry=loadLockedPackages(lock),options={})=>{
  const lines=[];
  execute(program,{registry,stdout:x=>lines.push(String(x)),...options});
  return lines.join('\n');
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(fn){
  const dir=mkdtempSync(join(tmpdir(),'hcode-m16-2-ci-'));
  try {
    const pkg=join(dir,'packages/poly.signs');
    mkdirSync(pkg,{recursive:true});
    cpSync(join(root,'packages/poly.signs/manifest.json'),join(pkg,'manifest.json'));
    cpSync(join(root,'packages/poly.signs/lib.hc'),join(pkg,'lib.hc'));
    const lk=JSON.parse(readFileSync(lock,'utf8')),filename=join(dir,'hcode.lock.json');
    const save=()=>{
      lk.packages[0].manifestSha256=sha(readFileSync(join(pkg,'manifest.json')));
      lk.packages[0].sourceSha256=sha(readFileSync(join(pkg,'lib.hc')));
      writeFileSync(filename,JSON.stringify(lk));
    };
    save();
    const editManifest=cb=>{
      const m=JSON.parse(readFileSync(join(pkg,'manifest.json'),'utf8'));
      cb(m);writeFileSync(join(pkg,'manifest.json'),JSON.stringify(m));save();
    };
    const editSource=s=>{writeFileSync(join(pkg,'lib.hc'),s);save();};
    return fn({load:()=>loadLockedPackages(filename),filename,pkg,editManifest,editSource,lk});
  }finally{rmSync(dir,{force:true,recursive:true});}
}

test('∀ and forall are identical canonical parser tokens and reserved from user glyphs',()=>{
  const glyph='∀T ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧;';
  const ascii='forall T fn head(xs:[[T]]) -> T return xs[[0]];';
  assert.deepEqual(parse(glyph),parse(ascii));
  assert.equal(tokenize('∀')[0].type,'forall');
  assert.equal(tokenize('forall')[0].type,'forall');
  assert.equal(RESERVED_USER_GLYPHS.has('∀'),true);
  assert.equal('∀'.normalize('NFKC'),'∀');
  for(const bad of ['∀T,T ƒ f(x:T)→T ↩ x;','∀Number ƒ f(x:Number)→Number ↩ x;',
                    '∀T ≔x←1;','∀T,U,V,W,X,Y,Z,P,Q ƒ f(x:T)→T ↩ x;'])
    assert.throws(()=>parse(bad),/binder|function|too many|Invalid/);
});

test('real signed library implements independent Number, String, Bool and nested use sites',()=>{
  const registry=loadLockedPackages(lock);
  assert.equal(registry.size,1);
  const demo=readFileSync(join(root,'packages/poly.signs/demo.hc'),'utf8');
  assert.equal(stdout(demo,registry),'2\na\ntrue\n4\n4');
  const code=uses+'print(poly∷⥇(⟦1,2⟧));print(poly∷⥇(⟦"text","other"⟧));'+
    'print(poly∷⥇(⟦⊥,⊤⟧));print(⌗poly∷⥇(⟦⟦1,2⟧,⟦3⟧⟧));';
  assert.equal(stdout(code,registry),'1\ntext\nfalse\n2');
  assert.equal(stdout(uses+'print(⌗poly∷⥈(⟦⟦1⟧,⟦2⟧⟧));',registry),'4');
  assert.equal(stdout(uses+'print(poly∷head(⟦"a","b"⟧));',registry),'a');
});

test('each invocation is specialized freshly, without leaking earlier T to later calls',()=>{
  const r=loadLockedPackages(lock);
  const cases=[
    ['⟦1,2⟧','Number',1],['⟦"a","b"⟧','String','a'],
    ['⟦⊤,⊥⟧','Bool',true],['⟦⟦1⟧,⟦2⟧⟧','⟦Number⟧',[1]]
  ];
  for(const [code,_,value] of cases){
    const result=[];execute(uses+'print(poly∷⥇('+code+'));',{registry:r,stdout:x=>result.push(String(x))});
    assert.equal(result[0],String(value));
  }
  assert.equal(stdout(uses+'print(poly∷⥇(⟦1⟧));print(poly∷⥇(⟦"x"⟧));',r),'1\nx');
  const operation=r.get('poly.signs@1.0.0').manifest.operations[0];
  for(const input of [[1],['x'],[true]]) {
    const result=specializeCall(operation,[input]);
    checkSpecializedReturn(input[0],result);
  }
  assert.equal(normalizeBinders(['T'])[0],'T');
});

test('mismatched element types, arity and unknown empty type are rejected',()=>{
  const r=loadLockedPackages(lock);
  for(const program of [
    uses+'print(poly∷⥇(⟦⟧));',
    uses+'print(poly∷⥈(⟦⟧));',
    uses+'print(poly∷⥇(⟦1,"x"⟧));',
    uses+'print(poly∷⥇(42));',
    uses+'print(poly∷⥇());',
    uses+'print(poly∷⥈(⟦1⟧,⟦2⟧));'
  ]) assert.throws(()=>stdout(program,r),/generic|type|matching|expects|Cannot infer|Heterogeneous/i,program);
  assert.throws(()=>stdout('print(⥇(⟦1⟧));',r),/Unbound glyph/);
});

test('a universal return T cannot secretly be a constant or restricted primitive operator',()=>{
  for(const invalid of [
    '∀T ƒ head(xs:⟦T⟧)→T ↩ 42;',
    '∀T ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧+xs⟦0⟧;',
    '∀T ƒ head(xs:⟦T⟧)→T ↩ "bad";',
    '∀T ƒ head(xs:⟦T⟧)→T ↩ print(xs);'
  ])fixture(f=>{
    f.editSource(invalid+'\n∀T ƒ repeat(xs:⟦T⟧)→⟦T⟧ ↩ xs⧺xs;\n');
    assert.throws(()=>f.load(),/expected|Unknown|requires|pure|H-Code package/i,invalid);
  });
});

test('manifest typeParameters must match source binder and cannot impersonate Any',()=>{
  fixture(f=>{
    f.editManifest(m=>{m.operations[0].typeParameters=['U'];
      m.operations[0].parameters[0].type='⟦U⟧';m.operations[0].returns='U';});
    assert.throws(()=>f.load(),/binder mismatch/i);
  });
  fixture(f=>{f.editManifest(m=>m.operations[0].returns='Any');assert.throws(()=>f.load(),/Unsupported|unbound/);});
  fixture(f=>{f.editManifest(m=>m.operations[0].parameters[0].type='⟦U⟧');assert.throws(()=>f.load(),/unbound|Unsupported/);});
  fixture(f=>{f.editManifest(m=>m.operations[0].typeParameters=['T','T']);assert.throws(()=>f.load(),/Duplicate/);});
  fixture(f=>{f.editManifest(m=>m.operations[0].typeParameters=['Number']);assert.throws(()=>f.load(),/Invalid/);});
  fixture(f=>{f.editManifest(m=>m.operations[0].glyph='∀');assert.throws(()=>f.load(),/reserved core glyph/);});
  for(const version of [1,2]){
    fixture(f=>{f.editManifest(m=>m.format=version);assert.throws(()=>f.load(),/format|typed|source|∀/i);});
  }
});

test('source and manifest SHA-256 are enforced before any generic type is trusted',()=>{
  fixture(f=>{
    assert.equal(f.load().size,1);
    writeFileSync(join(f.pkg,'lib.hc'),'∀T ƒ head(xs:⟦T⟧)→T ↩ 900;\n');
    assert.throws(()=>f.load(),/source SHA-256 mismatch/);
  });
  fixture(f=>{
    writeFileSync(join(f.pkg,'manifest.json'),'{}\n');
    assert.throws(()=>f.load(),/manifest SHA-256 mismatch/);
  });
});

test('generic package shares normal bounded budget and cannot call ambient print',()=>{
  const r=loadLockedPackages(lock);
  assert.throws(()=>stdout(uses+'print(⌗poly∷⥈(⟦1,2,3⟧));',r,{maxSteps:4}),/Execution step limit/);
  assert.throws(()=>stdout(uses+'print(⌗poly∷⥈(⟦1,2,3⟧));',r,{maxSequenceItems:2}),/Sequence allocation limit/);
  fixture(f=>{
    f.editSource('∀T ƒ head(xs:⟦T⟧)→T ↩ print(xs);\n∀T ƒ repeat(xs:⟦T⟧)→⟦T⟧ ↩ xs⧺xs;\n');
    assert.throws(()=>f.load(),/Unknown or effectful identifier|pure/i);
  });
});

test('v1 and concrete v2 remain exactly backwards compatible',()=>{
  const v1=loadLockedPackages(join(root,'hcode.lock.json'));
  const v2=loadLockedPackages(join(root,'hcode.m16.lock.json'));
  assert.equal(stdout('use "demo.math@1.0.0" as m;print(m∷⊕(20,22));',v1),'42');
  assert.equal(stdout('use "vec.math@1.0.0" as v;print(v∷⊚(⟦2,3,5⟧));',v2),'10');
});
