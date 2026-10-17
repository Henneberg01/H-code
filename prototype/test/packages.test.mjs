import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parse,linkProgram,execute,tokenize,HCodeError} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const root=resolve('.');
const registry=loadLockedPackages(join(root,'hcode.lock.json'));
function out(source,reg=registry,opts={}){
  const stdout=[];
  execute(source,{registry:reg,stdout:line=>stdout.push(line),...opts});
  return stdout;
}
const prefix='use "demo.math@1.0.0" as math;\n';
const sha=data=>createHash('sha256').update(data).digest('hex');
function withFixture(fn){
  const dir=mkdtempSync(join(tmpdir(),'hcode-m1-'));
  try{
    mkdirSync(join(dir,'packages'),{recursive:true});
    cpSync(join(root,'packages/demo.math'),join(dir,'packages/demo.math'),{recursive:true});
    const lock=JSON.parse(readFileSync(join(root,'hcode.lock.json'),'utf8'));
    writeFileSync(join(dir,'hcode.lock.json'),JSON.stringify(lock));
    const pkg=join(dir,'packages/demo.math');
    const update=()=>{
      const manifest=readFileSync(join(pkg,'manifest.json'));
      const source=readFileSync(join(pkg,'lib.hc'));
      lock.packages[0].manifestSha256=sha(manifest);
      lock.packages[0].sourceSha256=sha(source);
      writeFileSync(join(dir,'hcode.lock.json'),JSON.stringify(lock));
    };
    const editManifest=fn=>{
      const path=join(pkg,'manifest.json');const obj=JSON.parse(readFileSync(path,'utf8'));
      fn(obj);writeFileSync(path,JSON.stringify(obj));update();
    };
    const editSource=fn=>{
      const path=join(pkg,'lib.hc');writeFileSync(path,fn(readFileSync(path,'utf8')));update();
    };
    return fn({dir,pkg,lock,update,editManifest,editSource,load:()=>loadLockedPackages(join(dir,'hcode.lock.json'))});
  } finally{rmSync(dir,{recursive:true,force:true});}
}

test('symbol, qualified glyph and readable package name lower to the same linked operation',()=>{
  const cases=['⊕(20, 22)','math::add(20, 22)','math∷⊕(20, 22)'];
  const programs=cases.map(c=>linkProgram(parse(prefix+c+';'),registry));
  for(const program of programs.slice(1))assert.deepEqual(program,programs[0]);
  assert.deepEqual(out(prefix+cases.map(c=>'print('+c+');').join('\n')),['42','42','42']);
});
test('operation references have canonical version-locked ids and support first-class calls',()=>{
  const ast=linkProgram(parse(prefix+'let action = ⊕; print(action(1,2));'),registry);
  assert.equal(ast.body[1].value.id,'demo.math@1.0.0::add');
  assert.deepEqual(out(prefix+'let action = ⊕; print(action(4,6));'),['10']);
});
test('types are checked on direct literal arguments before execution',()=>{
  assert.throws(()=>linkProgram(parse(prefix+'print(⊕("bad", 2));'),registry),/expects Number, got String/);
  assert.throws(()=>linkProgram(parse(prefix+'print(▦(true));'),registry),/expects String, got Bool/);
  assert.throws(()=>linkProgram(parse(prefix+'print(⊕(1));'),registry),/expects 2 argument/);
});
test('runtime enforces argument types for dynamic values and first-class symbol refs',()=>{
  assert.throws(()=>out(prefix+'let bad = "bad"; print(⊕(bad, 2));'),/argument 1 \(a\) expects Number, got String/);
  assert.throws(()=>out(prefix+'let f = ⊕; f(1);'),/expects 2 argument/);
});
test('return values must match declared return type even if library source lies',()=>withFixture(f=>{
  f.editSource(source=>source.replace('return a + b;', 'return "incorrect";'));
  const reg=f.load();
  assert.throws(()=>out(prefix+'print(⊕(1,2));',reg),/return expects Number, got String/);
}));
test('manifest types must exactly agree with H-Code implementation signatures',()=>withFixture(f=>{
  f.editManifest(m=>m.operations[0].returns='String');
  assert.throws(()=>f.load(),/return type mismatch/);
}));
test('library scope cannot access global print or main-program values',()=>withFixture(f=>{
  f.editSource(s=>s.replace('return a + b;', 'print("evil"); return a + b;'));
  const reg=f.load();const stdout=[];
  assert.throws(()=>execute(prefix+'print(⊕(2,3));',{registry:reg,stdout:s=>stdout.push(s)}),/Unknown name print/);
  assert.deepEqual(stdout,[]);
}));
test('declared filesystem or network effects are explicitly rejected in M1',()=>withFixture(f=>{
  f.editManifest(m=>m.operations[0].effects=['filesystem.write']);
  assert.throws(()=>f.load(),/only pure operations/);
}));
test('a changed library source fails SHA-256 validation',()=>withFixture(f=>{
  writeFileSync(join(f.pkg,'lib.hc'),readFileSync(join(f.pkg,'lib.hc'),'utf8')+'\n');
  assert.throws(()=>f.load(),/source SHA-256 mismatch/);
}));
test('a changed library manifest fails SHA-256 validation',()=>withFixture(f=>{
  writeFileSync(join(f.pkg,'manifest.json'),readFileSync(join(f.pkg,'manifest.json'),'utf8')+'\n');
  assert.throws(()=>f.load(),/manifest SHA-256 mismatch/);
}));
test('package imports are explicit, missing versions and unknown aliases are errors',()=>{
  assert.throws(()=>out('print(⊕(2,3));'),/Unbound glyph/);
  assert.throws(()=>out('print(math::add(2,3));'),/Unknown package alias/);
  assert.throws(()=>out('use "demo.math@2.0.0" as math; print(⊕(2,3));'),/not available in the locked registry/);
  assert.throws(()=>out('use "demo.math" as math; print(⊕(2,3));'),/Invalid package specifier/);
  assert.throws(()=>out('use "demo.math@1.0.0" as math; use "demo.math@1.0.0" as math; print(1);'),/Duplicate package alias/);
  assert.throws(()=>out(prefix+'print(math::missing(2,3));'),/Unknown operation/);
  assert.throws(()=>out(prefix+'let math = 1;'),/conflicts with import alias/);
  assert.throws(()=>parse('fn f(){ use "demo.math@1.0.0" as math; }'),/imports must be top-level/);
});
test('colliding glyphs in different imported packages require qualification',()=>withFixture(f=>{
  const manifest=JSON.parse(readFileSync(join(f.pkg,'manifest.json'),'utf8'));
  manifest.name='demo.other';
  const otherDir=join(f.dir,'packages/demo.other');
  mkdirSync(otherDir);
  cpSync(join(f.pkg,'lib.hc'),join(otherDir,'lib.hc'));
  writeFileSync(join(otherDir,'manifest.json'),JSON.stringify(manifest));
  f.lock.packages.push({
    name:'demo.other',version:'1.0.0',manifest:'packages/demo.other/manifest.json',
    manifestSha256:sha(readFileSync(join(otherDir,'manifest.json'))),
    sourceSha256:sha(readFileSync(join(otherDir,'lib.hc')))
  });
  writeFileSync(join(f.dir,'hcode.lock.json'),JSON.stringify(f.lock));
  const reg=f.load(),uses=prefix+'use "demo.other@1.0.0" as other;\n';
  assert.throws(()=>out(uses+'print(⊕(1,2));',reg),/Ambiguous glyph/);
  assert.deepEqual(out(uses+'print(math::add(1,2)); print(other::add(3,4));',reg),['3','7']);
  assert.deepEqual(out(uses+'print(other∷⊕(2,3));',reg),['5']);
}));
test('reserved core glyphs, duplicate symbols and unsafe contracts are rejected',()=>{
  withFixture(f=>{
    f.editManifest(m=>m.operations[0].glyph='ƒ');
    assert.throws(()=>f.load(),/reserved core glyph/);
  });
  withFixture(f=>{
    f.editManifest(m=>m.operations[1].glyph='⊕');
    assert.throws(()=>f.load(),/duplicate glyph/);
  });
  withFixture(f=>{
    f.editManifest(m=>m.operations[0].parameters[0].type='Any');
    assert.throws(()=>f.load(),/invalid typed parameter/);
  });
});
test('lockfiles cannot traverse outside the project directory',()=>withFixture(f=>{
  f.lock.packages[0].manifest='../other.json';
  writeFileSync(join(f.dir,'hcode.lock.json'),JSON.stringify(f.lock));
  assert.throws(()=>f.load(),/unsafe package path/);
}));
test('malformed manifests and unauthorized top-level library statements are rejected',()=>withFixture(f=>{
  f.editSource(s=>'print("side effect");\n'+s);
  assert.throws(()=>f.load(),/only top-level functions/);
}));
test('package execution obeys the same interpreter step limit as main code',()=>{
  assert.throws(()=>out(prefix+'print(⊗(50));',registry,{maxSteps:80}),/Execution step limit/);
});
test('CLI can run and check a package-backed program with an explicit lockfile',()=>{
  const run=spawnSync(process.execPath,['prototype/bin/hcode.mjs','run','examples/user_symbols.hc','--lock','hcode.lock.json'],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(run.stdout.trim().split('\n'),['42','42','11','hihi','true','120']);
  const check=spawnSync(process.execPath,['prototype/bin/hcode.mjs','check','examples/user_symbols.hc','--lock','hcode.lock.json'],{cwd:root,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  const blocked=spawnSync(process.execPath,['prototype/bin/hcode.mjs','run','examples/user_symbols.hc'],{cwd:root,encoding:'utf8'});
  assert.notEqual(blocked.status,0);
  assert.match(blocked.stderr,/not available in the locked registry/);
});
test('core glyphs and reserved name collision are unambiguous',()=>{
  assert.equal(tokenize('math∷⊕(1,2);')[1].type,'::');
  assert.throws(()=>out('use "demo.math@1.0.0" as math; let a = ∅;'),/Unbound glyph/);
  assert.throws(()=>out(prefix+'print(⊕(1,2));',{not:'a map'}),TypeError);
});
test('invalid byte order controls are rejected even inside comments and string literals',()=>{
  assert.throws(()=>parse('print("\u202e");'),HCodeError);
  assert.throws(()=>parse('// \u200b\nprint(1);'),HCodeError);
});
test('astral-plane Unicode symbols are tokenized and linked as one glyph',()=>withFixture(f=>{
  f.editManifest(m=>m.operations[0].glyph='🧮');
  const reg=f.load();
  assert.deepEqual(out(prefix+'print(🧮(20,22));',reg),['42']);
  assert.equal(tokenize('🧮(1,2);')[0].type,'glyph');
  assert.throws(()=>out(prefix+'print(⊕(1,2));',reg),/Unbound glyph/);
}));
test('default-ignorable Unicode is prohibited even inside comments and strings',()=>{
  assert.throws(()=>parse('print("a\u00adb");'),/Forbidden control/);
  assert.throws(()=>parse('// \ufe0f\nprint(1);'),/Forbidden control/);
});
test('built-in keywords cannot be exported as operation names',()=>withFixture(f=>{
  f.editManifest(m=>m.operations[0].name='return');
  assert.throws(()=>f.load(),/invalid operation name/);
}));
