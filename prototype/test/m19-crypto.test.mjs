import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,executeAsync,parse} from '../src/hcode.mjs';

const key='0b'.repeat(20),message='Hi There';
const expected=Buffer.from('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7','hex').toString('base64url');
const grants=(rights={sign:true,verify:true})=>({version:1,keys:{rfc:{hex:key,...rights}},random:true});
async function host(config=grants()){
  return (await import('../src/crypto-reference.mjs')).createCryptoReferenceHost(config);
}
function output(source,options={}){
  const lines=[];execute(source,{...options,stdout:x=>lines.push(x)});return lines;
}

test('⌁ is a real pure SHA-256 expression and alias has the same AST',()=>{
  assert.deepEqual(output('⎙(⌁"abc")'),['ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad']);
  assert.deepEqual(parse('⌁"abc"'),parse('sha256_text "abc"'));
  assert.deepEqual(output('⎙(⌁"")'),['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']);
});
test('⊩ and ⊨ implement RFC4231 HMAC with real typed signs and canonical aliases',async()=>{
  const cryptoHost=await host();
  assert.deepEqual(output('≔mac←⊩("rfc","Hi There")\n⎙(mac)\n⎙(⊨("rfc","Hi There",mac))',{cryptoHost}),[expected,'true']);
  assert.deepEqual(parse('⊩("rfc","Hi There")'),parse('hmac_sign("rfc","Hi There")'));
  assert.deepEqual(parse('⊨("rfc","Hi There","mac")'),parse('hmac_verify("rfc","Hi There","mac")'));
  assert.deepEqual(output('⎙(⊨("rfc","Other",⊩("rfc","Hi There")))',{cryptoHost}),['false']);
  assert.equal(cryptoHost.verify('rfc','',cryptoHost.sign('rfc','')),true);
});
test('MAC verification rejects malformed and noncanonical encodings',async()=>{
  const h=await host();
  for(const mac of ['',expected+'=',expected.slice(1),'A'.repeat(43),'!'.repeat(43),expected.slice(0,-1)+'9']){
    assert.equal(h.verify('rfc',message,mac),false,mac);
  }
  const changed=await host({version:1,keys:{rfc:{hex:'55'.repeat(32),sign:true,verify:true}}});
  assert.equal(changed.verify('rfc',message,expected),false);
});
test('crypto host is explicit and checks rights before malformed signatures',async()=>{
  assert.throws(()=>execute('⊩("rfc","data")'),/capability denied/);
  assert.throws(()=>execute('⊨("rfc","data","")'),/capability denied/);
  assert.throws(()=>execute('⚄24'),/capability denied/);
  assert.throws(()=>(output('⊩("rfc","data")',{cryptoHost:null})),/capability denied/);
  const verifyOnly=await host(grants({sign:false,verify:true}));
  assert.throws(()=>verifyOnly.sign('rfc','data'),/capability denied/);
  assert.equal(verifyOnly.verify('rfc',message,expected),true);
  const signOnly=await host(grants({sign:true,verify:false}));
  assert.throws(()=>signOnly.verify('rfc',message,''),/capability denied/);
  assert.throws(()=>signOnly.sign('unknown','data'),/capability denied/);
});
test('grants validate own properties, key bounds and finite exact shapes',async()=>{
  const {createCryptoReferenceHost:create}=await import('../src/crypto-reference.mjs');
  for(const config of [null,[],{}, {version:2}, {version:1,keys:{rfc:{hex:'xz'.repeat(20),sign:true,verify:true}}},
    {version:1,keys:{rfc:{hex:'00'.repeat(15),sign:true,verify:true}}},
    {version:1,keys:{rfc:{hex:'00'.repeat(129),sign:true,verify:true}}},
    {version:1,keys:{rfc:{hex:key,sign:'yes',verify:true}}},
    {version:1,random:'yes'}, {version:1,keys:{'bad alias':{hex:key,sign:true,verify:true}}},
    Object.assign(Object.create({version:1}),{keys:{}}),
    {version:1,keys:Object.create({rfc:{hex:key,sign:true,verify:true}})},
    {version:1,keys:Object.fromEntries(Array.from({length:33},(_,i)=>['k'+i,{hex:key,sign:true,verify:true}]))},
    {version:1,unknown:true}]) assert.throws(()=>create(config),/Invalid crypto grant/);
  const config=grants(),h=create(config);config.keys.rfc.hex='55'.repeat(32);
  assert.equal(h.sign('rfc',message),expected,'host snapshots key bytes');
  assert.throws(()=>h.sign('toString',message),/capability denied/);
  assert.ok(Object.isFrozen(h));
});
test('crypto text bounds are byte-exact and preserve runtime Unicode forms',async()=>{
  const h=await host();
  assert.equal(h.verify('rfc','x'.repeat(65536),h.sign('rfc','x'.repeat(65536))),true);
  for(const text of ['x'.repeat(65537),'\ud800'])assert.throws(()=>h.sign('rfc',text),/crypto input/);
  const a=output('⎙(⌁⌨)',{readStdin:()=> 'é'}),b=output('⎙(⌁⌨)',{readStdin:()=> 'e\u0301'});
  assert.notDeepEqual(a,b,'do not normalize runtime message bytes');
  assert.throws(()=>output('⌁⌨',{readStdin:()=> '\ud800'}),/crypto input/);
  assert.throws(()=>output('⌁7'),/String/);
});
test('crypto arity and operand types cannot silently bypass semantics',async()=>{
  const cryptoHost=await host();
  for(const source of ['⊩("rfc")','⊩("rfc","x","y")','⊨("rfc","x")','⊩(1,"x")','⊩("rfc",2)','⊨("rfc","x",2)','⚄"24"']){
    assert.throws(()=>execute(source,{cryptoHost}),undefined,source);
  }
});
test('host crypto effects fail in pure sort keys before any host call',async()=>{
  let calls=0;
  const cryptoHost={sign:()=>{calls++;return expected;},verify:()=>{calls++;return true;},random:()=>{calls++;return 'A'.repeat(32);}};
  for(const source of [
    '⟦"x"⟧↥λx:⊩("rfc",x)',
    'ƒ sign(x:String)→String ↩ ⊩("rfc",x)\n≔f←sign;\n⟦"x"⟧↥f',
    '⟦1⟧↧λx:(⊨("rfc","x","bad") ◇ 1 : 0)',
    '⟦"x"⟧↥λx:⚄24'
  ])assert.throws(()=>execute(source,{cryptoHost}),/effect denied/);
  assert.equal(calls,0);
  assert.doesNotThrow(()=>execute('⟦"x"⟧↥λx:⌁x'));
});
test('⚄ uses explicitly permitted CSPRNG with exact sizes and execution budget',async()=>{
  const h=await host();
  for(const bytes of [16,24,64]){
    const result=h.random(bytes);assert.equal(Buffer.from(result,'base64url').length,bytes);
    assert.equal(Buffer.from(result,'base64url').toString('base64url'),result);
  }
  for(const bytes of [15,65,0,-1,24.5,NaN,Infinity])assert.throws(()=>h.random(bytes),/random byte count/);
  const denied=await host({version:1,keys:{}});assert.throws(()=>denied.random(24),/capability denied/);
  let calls=0;const cryptoHost={random:()=>{calls++;return 'A'.repeat(32);}};
  assert.throws(()=>execute('≔n←0\n⟳(n<65){⚄24\nn←n+1}',{cryptoHost}),/entropy budget/);
  assert.equal(calls,64);
  assert.deepEqual(parse('⚄24'),parse('random_id 24'));
});
test('async replay journals random results and keeps independent executions separate',async()=>{
  let calls=0;const cryptoHost={random:()=>Buffer.alloc(24,++calls).toString('base64url')};
  const source='≔a←⚄24\n⌛1\n≔b←⚄24\n⤋"http://fixture.test/a"\n⎙(a)\n⎙(b)';
  const lines=[];
  const options={cryptoHost,sleepMs:async()=>{},httpGet:async()=>({status:200,ok:true,body:'ok',retryAfter:0}),stdout:x=>lines.push(x)};
  await executeAsync(source,options);
  assert.equal(calls,2);assert.deepEqual(lines,[Buffer.alloc(24,1).toString('base64url'),Buffer.alloc(24,2).toString('base64url')]);
  await executeAsync(source,{...options,stdout:()=>{}});assert.equal(calls,4);
});
test('malicious host results and exceptions are rejected without exposing content',()=>{
  const secret='DO_NOT_LEAK_THIS';
  for(const [source,cryptoHost] of [
    ['⊩("rfc","message")',{sign:()=>secret}],
    ['⊨("rfc","message","mac")',{verify:()=>secret}],
    ['⚄24',{random:()=>secret}],
    ['⚄24',{random:()=>{throw Error(secret);}}],
    ['⊩("rfc","message")',{sign:()=>{throw Error(secret);}}]
  ])assert.throws(()=>execute(source,{cryptoHost}),e=>!e.message.includes(secret)&&/crypto|entropy/.test(e.message));
});
