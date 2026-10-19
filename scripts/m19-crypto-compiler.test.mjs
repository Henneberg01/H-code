// Real Rust → ESM execution, compared with the independent reference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execute} from '../prototype/src/hcode.mjs';
import {createCryptoReferenceHost} from '../prototype/src/crypto-reference.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const key='0b'.repeat(20),grants={version:1,keys:{rfc:{hex:key,sign:true,verify:true}},random:true};
const cli=join(root,'compiler/target/debug/hcodec'+(process.platform==='win32'?'.exe':''));
function withBuild(source,run){
  const dir=mkdtempSync(join(tmpdir(),'jfh-crypto-')),input=join(dir,'program.hc'),output=join(dir,'program.mjs');
  try{
    writeFileSync(input,source);
    const build=spawnSync(cli,['build',input,'--out',output],{cwd:root,encoding:'utf8',timeout:30000});
    assert.equal(build.status,0,build.stderr||String(build.error));
    return run(output,readFileSync(output,'utf8'));
  }finally{rmSync(dir,{recursive:true,force:true});}
}
function run(program,grant=grants,input=''){
  const env={...process.env};delete env.HCODE_CRYPTO_GRANTS;
  if(grant!==null)env.HCODE_CRYPTO_GRANTS=JSON.stringify(grant);
  return spawnSync(process.execPath,[program],{encoding:'utf8',env,input,timeout:10000});
}
test('real Rust compiler crypto signs match independent reference on varied messages',()=>{
  for(const message of ['', 'Hi There','dansk æøå','😀 & <script>', 'x'.repeat(2048)]){
    const source='≔m←'+JSON.stringify(message)+'\n≔s←⊩("rfc",m)\n⎙(⌁m)\n⎙(s)\n⎙(⊨("rfc",m,s))\n⎙(⊨("rfc",m+"changed",s))';
    const expected=[];execute(source,{cryptoHost:createCryptoReferenceHost(grants),stdout:s=>expected.push(s)});
    withBuild(source,(output,esm)=>{
      assert.equal(esm.includes(key),false,'host key must not be compiled into ESM');
      const result=run(output);assert.equal(result.status,0,result.stderr);
      assert.equal(result.stdout,expected.join('\n')+'\n');
    });
  }
});
test('real Rust-generated entropy has exact bounds and denied capabilities fail',()=>{
  withBuild('⎙(⚄24)',output=>{
    const result=run(output);assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/^[A-Za-z0-9_-]{32}\n$/);
    assert.notEqual(run(output,null).status,0);
  });
  withBuild('≔n←0\n⟳(n<65){⚄24\nn←n+1}',output=>{
    const result=run(output);assert.notEqual(result.status,0);assert.match(result.stderr,/entropy budget/);
  });
});
test('real Rust crypto linkage is nested and indirect pure effects fail at runtime',()=>{
  withBuild('⎙(⌁(⤒⦃x:1⦄))',output=>{
    const result=run(output,null);assert.equal(result.status,0,result.stderr);
    const expected=[];execute('⎙(⌁(⤒⦃x:1⦄))',{stdout:s=>expected.push(s)});
    assert.equal(result.stdout,expected.join('\n')+'\n');
  });
  withBuild('ƒ keyed(s:String)→String ↩ ⊩("rfc",s); ≔f←keyed; ⟦"x"⟧↥f',output=>{
    const result=run(output);assert.notEqual(result.status,0);assert.match(result.stderr,/effect denied/);
  });
});
test('real Rust hashes exact runtime Unicode bytes and rejects malformed UTF-8',()=>{
  withBuild('⎙(⌁⌨)',output=>{
    assert.notEqual(run(output,null,'é').stdout,run(output,null,'e\u0301').stdout);
    const invalid=run(output,null,Buffer.from([0xc0,0x80]));
    assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Invalid UTF-8/);
  });
});
test('real Rust executes crypto and nested JSON used only in a while condition',()=>{
  for(const source of ['⟳(⊨("rfc","x","bad")){⎙(1)}',
    '⟳(⌁(⤒⦃x:1⦄)≡"never"){}']){
    withBuild(source,output=>{
      const result=run(output);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');
    });
  }
});
