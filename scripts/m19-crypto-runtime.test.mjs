import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createCryptoReferenceHost} from '../prototype/src/crypto-reference.mjs';
const pure=readFileSync(new URL('../compiler/src/crypto_prelude.js',import.meta.url),'utf8');
const effect=readFileSync(new URL('../compiler/src/crypto_effects_prelude.js',import.meta.url),'utf8');
const key='0b'.repeat(20),grant={version:1,keys:{rfc:{hex:key,sign:true,verify:true}},random:true};
function run(source,config=grant,linkedEffects=true){
  const env={...process.env};delete env.HCODE_CRYPTO_GRANTS;
  if(config!==undefined)env.HCODE_CRYPTO_GRANTS=typeof config==='string'?config:JSON.stringify(config);
  return spawnSync(process.execPath,['--input-type=module','-e',
    'const __hc_tick=()=>{};let __hc_cas_reducer_active=false;\n'+pure+(linkedEffects?effect:'')+'\n'+source],
    {encoding:'utf8',env,timeout:10000});
}
test('generated crypto prelude matches independent reference and known-answer HMAC',()=>{
  const expected=createCryptoReferenceHost(grant).sign('rfc','Hi There');
  const result=run('const m=__hc_crypto_sign("rfc","Hi There");console.log(m);console.log(__hc_crypto_verify("rfc","Hi There",m));');
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,expected+'\ntrue\n');
});
test('generated crypto runtime rejects malformed MACs and permissions',()=>{
  const h=createCryptoReferenceHost(grant),mac=h.sign('rfc','Hi There');
  for(const m of ['',mac+'=',mac.slice(0,-1)+'9','!'.repeat(43)]){
    const result=run('console.log(__hc_crypto_verify("rfc","Hi There",'+JSON.stringify(m)+'));');
    assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'false\n');
  }
  const denied=run('console.log(__hc_crypto_verify("rfc","Hi There",""));',{version:1,keys:{}});
  assert.notEqual(denied.status,0);assert.match(denied.stderr,/capability denied/);
});
test('pure hash links neither keys nor entropy and accepts no grant',()=>{
  assert.equal(pure.includes('HCODE_CRYPTO_GRANTS'),false);
  assert.equal(pure.includes('randomBytes'),false);
  const result=run('console.log(__hc_crypto_hash("abc"));','invalid secret config',false);
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad\n');
});
test('generated crypto validates random limits, purity and grant schemas',()=>{
  const valid=run('for(const n of [16,24,64])console.log(Buffer.from(__hc_crypto_random(n),"base64url").length);');
  assert.equal(valid.status,0,valid.stderr);assert.equal(valid.stdout,'16\n24\n64\n');
  for(const action of ['__hc_crypto_random(15)','__hc_crypto_random(24.5)',
    'for(let n=0;n<65;n++)__hc_crypto_random(24)',
    '__hc_cas_reducer_active=true;__hc_crypto_sign("rfc","x")',
    '__hc_cas_reducer_active=true;__hc_crypto_verify("rfc","x","")',
    '__hc_cas_reducer_active=true;__hc_crypto_random(24)']){
    const result=run(action);assert.notEqual(result.status,0,action);
    assert.match(result.stderr,/random byte count|entropy budget|effect denied/);
  }
  for(const config of ['invalid secret config',{version:2},{version:1,random:'yes'},
    {version:1,keys:{rfc:{hex:'secret!',sign:true,verify:true}}}]){
    const result=run('console.log("unexpected")',config);assert.notEqual(result.status,0);
    assert.match(result.stderr,/Invalid crypto grant/);assert.equal(result.stderr.includes('secret!'),false);
  }
});
