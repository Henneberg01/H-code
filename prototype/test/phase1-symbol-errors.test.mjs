import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse,execute,linkProgram,tokenize,HCodeError} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=s=>createHash('sha256').update(s).digest('hex');
const output=(src,registry=new Map())=>{
  const lines=[];
  execute(src,{registry,stdout:v=>lines.push(String(v))});
  return lines.join('\n');
};
function withPackages(fn){
  const dir=mkdtempSync(join(tmpdir(),'hcode-phase1-symbols-'));
  try {
    mkdirSync(join(dir,'packages'),{recursive:true});
    cpSync(join(root,'packages/demo.math'),join(dir,'packages/demo.math'),{recursive:true});
    const lock=JSON.parse(readFileSync(join(root,'hcode.lock.json'),'utf8'));
    const filename=join(dir,'hcode.lock.json');
    const manifestPath=join(dir,'packages/demo.math/manifest.json');
    const refresh=()=>{
      lock.packages[0].manifestSha256=sha(readFileSync(manifestPath));
      lock.packages[0].sourceSha256=sha(readFileSync(join(dir,'packages/demo.math/lib.hc')));
      writeFileSync(filename,JSON.stringify(lock));
    };
    refresh();
    return fn({dir,lock,filename,manifestPath,refresh,load:()=>loadLockedPackages(filename)});
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test('unknown and reserved signs are never resolved silently',()=>{
  for(const code of ['print(⚡(1));','print(∅);']){
    assert.throws(()=>output(code),/Unbound glyph/);
  }
  assert.throws(()=>output('print(⊕(1,2));'),/Unbound glyph/);
});

test('invisible Unicode and bidi controls fail even inside comments and strings',()=>{
  const cases=['//\u202E forged\nprint(1);','let x = 1; //\u200B concealed','print("a\u200Db");'];
  for(const code of cases)assert.throws(()=>tokenize(code),/Forbidden control/);
  assert.throws(()=>parse('≔ x ← \u200B1;'),HCodeError);
});

test('tampered manifest and NFKC-unstable glyph are rejected',()=>{
  withPackages(f=>{
    writeFileSync(f.manifestPath,readFileSync(f.manifestPath,'utf8')+'\n');
    assert.throws(()=>f.load(),/manifest SHA-256 mismatch/);
  });
  withPackages(f=>{
    const manifest=JSON.parse(readFileSync(f.manifestPath,'utf8'));
    manifest.operations[0].glyph='㎞';
    writeFileSync(f.manifestPath,JSON.stringify(manifest));f.refresh();
    assert.throws(()=>f.load(),/glyph is not stable under Unicode normalization/);
  });
});

test('ambiguous package signs require explicit qualified references',()=>{
  withPackages(f=>{
    const source=join(f.dir,'packages/demo.math/lib.hc');
    const manifest=JSON.parse(readFileSync(f.manifestPath,'utf8'));
    manifest.name='demo.other';
    const other=join(f.dir,'packages/demo.other');
    mkdirSync(other);
    cpSync(source,join(other,'lib.hc'));
    const otherManifest=join(other,'manifest.json');
    writeFileSync(otherManifest,JSON.stringify(manifest));
    f.lock.packages.push({name:'demo.other',version:'1.0.0',manifest:'packages/demo.other/manifest.json',manifestSha256:sha(readFileSync(otherManifest)),sourceSha256:sha(readFileSync(join(other,'lib.hc')))});
    f.refresh();
    const registry=f.load();
    const imports='use "demo.math@1.0.0" as math; use "demo.other@1.0.0" as other;\n';
    assert.throws(()=>linkProgram(parse(imports+'print(⊕(2,3));'),registry),/Ambiguous glyph/);
    assert.equal(output(imports+'print(math::add(2,3)); print(other∷⊕(4,5));',registry),'5\n9');
  });
});
