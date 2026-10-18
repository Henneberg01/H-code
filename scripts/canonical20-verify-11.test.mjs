// M19.11 original canonical11 Markdown heading/link extraction.
// Fully frozen registry, user H-Code, independent TS oracle and six fixtures.
// Verify actual Rust-generated Node ESM + independently implemented H-Code JS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {execute} from '../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/11-markdown-processing.hc','e826116ae1f7df4603fad62aee356594c7e58d5f'],
 ts:['compact/canonical20/programs/11-markdown-processing.ts','b60a9066f1b73c97737e131ebd21b23cd2fbf066'],
 cases:['compact/canonical20/cases/11-markdown-processing.json','754ec2974a3194389ab9e8bf6add038217914fa3']
});
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function checked(key){
 const [path,sha]=FROZEN[key],bytes=readFileSync(join(root,path));
 assert.equal(blob(bytes),sha,'Source-locked canonical11 file changed: '+path);
 return {path,source:bytes.toString('utf8'),codepoints:[...bytes.toString('utf8')].length,bytes:bytes.length};
}
function contract(){
 const all=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,checked(k)]));
 const registry=JSON.parse(all.registry.source),fixtures=JSON.parse(all.cases.source);
 const w=registry.workloads?.[10];
 assert.equal(registry.workloads.length,20);
 assert.equal(w.id,'11-markdown-processing');
 assert.equal(w.acceptance,'parse headings/links into deterministic structured output on an agreed fixture');
 assert.equal(w.status,'unsupported');assert.equal(w.evidence,null);
 assert.deepEqual(w.requiredCapabilities,['string-processing','records','markdown-library']);
 assert.equal(fixtures.acceptance,w.acceptance);
 assert.equal(fixtures.originalRegistryGitBlobSha,FROZEN.registry[1]);
 assert.equal(fixtures.cases.length,6);
 return {all,fixtures};
}
function compile({path}){
 const tmp=mkdtempSync(join(tmpdir(),'hcode11-build-')),out=join(tmp,'markdown.mjs');
 const p=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
   '--','build',join(root,path),'--out',out],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000});
 if(p.error||p.status!==0){
  rmSync(tmp,{recursive:true,force:true});
  throw Error('Real Rust compiler refused canonical11 program: '+(p.error?.message||p.stderr));
 }
 const compiled=readFileSync(out),js=compiled.toString('utf8');
 assert.match(js,/__hc_md_tokens/);
 assert.match(js,/Markdown token limit exceeded/);
 return {tmp,out,bytes:compiled.length,sha:createHash('sha256').update(compiled).digest('hex')};
}
function run(args,input){
 return spawnSync(process.execPath,args,{cwd:root,windowsHide:true,encoding:'utf8',input,timeout:15000,maxBuffer:8*1024*1024});
}
function reference(source,input){
 const lines=[];execute(source,{readStdin:()=>input,stdout:x=>lines.push(x)});
 return lines.join('\n')+'\n';
}
function generate(){
 const values=[];
 for(let i=0;i<19;i++){
  const h='#'.repeat(i%6+1),name='Section '+i+(i%3===0?' 🧩':'');
  const label='Read-'+i,href='https://example.org/docs/'+i;
  const doc=h+' '+name+'\n[A '+label+']('+href+')\n'+'~~~js\n# hidden\n[hidden](x)\n~~~\n';
  values.push({id:'generated-'+i,document:doc,expected:[
   {href:'',kind:'heading',level:i%6+1,text:name},
   {href,kind:'link',level:0,text:'A '+label}
  ]});
 }
 return values;
}
test('original Markdown acceptance: six frozen fixtures + nineteen generated cases in three independent engines',()=>{
 const {all,fixtures}=contract(),compiled=compile(all.hc);
 try{
  console.log('CANONICAL11_GENERATED_JS_BYTES='+compiled.bytes);
  console.log('CANONICAL11_GENERATED_JS_SHA256='+compiled.sha);
  for(const fixture of [...fixtures.cases,...generate()]){
   const rust=run([compiled.out],fixture.document),
         ts=run(['--experimental-strip-types',join(root,all.ts.path)],fixture.document);
   assert.ifError(rust.error);assert.ifError(ts.error);
   assert.equal(rust.status,0,fixture.id+' Rust: '+rust.stderr);
   assert.equal(ts.status,0,fixture.id+' TS: '+ts.stderr);
   const ref=reference(all.hc.source,fixture.document);
   assert.equal(rust.stdout,ref,fixture.id+' Rust/JS mismatch');
   assert.equal(ts.stdout,ref,fixture.id+' TS/JS mismatch');
   assert.deepEqual(JSON.parse(rust.stdout),fixture.expected,fixture.id+' fixture expected tokens');
   const events=JSON.parse(rust.stdout);
   assert.ok(events.every(x=>
     Object.keys(x).join(',')==='href,kind,level,text'&&
     typeof x.href==='string'&&typeof x.text==='string'&&
     Number.isSafeInteger(x.level)&&
     (x.kind==='link'&&x.level===0||x.kind==='heading'&&x.level>=1&&x.level<=6)
   ),fixture.id+' produced noncanonical structural record');
  }
 }finally{rmSync(compiled.tmp,{recursive:true,force:true});}
});
test('four ill-typed Markdown sources fail in both Rust checker and JS reference',()=>{
 const invalid=['≋42;','≋⊤;','≋⟦"a"⟧;','≋⦃name:"x"⦄;'];
 const tmp=mkdtempSync(join(tmpdir(),'hcode11-invalid-'));
 try{
  for(let i=0;i<invalid.length;i++){
   const path=join(tmp,'bad-'+i+'.hc');writeFileSync(path,invalid[i]);
   const rust=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','check',path],
      {cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
   assert.ifError(rust.error);assert.notEqual(rust.status,0,invalid[i]+' unexpectedly compiled');
   assert.match(rust.stderr,/≋ expects Markdown String input/);
   assert.throws(()=>execute(invalid[i]),/Markdown expects String input/);
  }
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('CLI rejects malformed UTF-8 before Markdown evaluation, without partial JSON output',()=>{
 const {all}=contract(),compiled=compile(all.hc);
 try{
  const invalid=Buffer.from([0x23,0x20,0xFF,0x0A]);
  const r=run([compiled.out],invalid);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Invalid UTF-8/);
  assert.equal(r.stdout,'');
  const tooLong=run([compiled.out],'# X\n'.repeat(20000));
  assert.notEqual(tooLong.status,0);
  assert.match(tooLong.stderr,/64 KiB|exceeds|input/i);
  assert.equal(tooLong.stdout,'');
 }finally{rmSync(compiled.tmp,{recursive:true,force:true});}
});
