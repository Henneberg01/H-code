// M19.07 original canonical07 proof: read actual project data, transform by
// existing typed CSV/JSON symbols and atomically write byte-exact output.
// Real Rust compiler and independent H-Code JS and TS correctness oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,readdirSync,symlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {executeAsync} from '../prototype/src/hcode.mjs';
import {createFileWriteCapability} from '../runtime/file-write.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixed={
  registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
  hc:['compact/canonical20/programs/07-file-conversion.hc','b93015a0dab3cd5b616026a16348de97162b5bac'],
  ts:['compact/canonical20/programs/07-file-conversion.ts','7c685dc1fd2d6ff52ea26d4a5e2dea8438d6d51c'],
  products:['compact/canonical20/cases/07-products.csv','46e536392d088824e261e44a1baf5aa441bcdf3d'],
  unicode:['compact/canonical20/cases/07-unicode.csv','508b88528f82cec4b393768f355f87d5aacaa12a'],
  empty:['compact/canonical20/cases/07-header-only.csv','f692fb78f747d391f69361885b81ac16c0089bc6'],
  malformed:['compact/canonical20/cases/07-malformed.csv','222761cc354efa336adce033cb6a04012f825fe0']
};
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function locked(name){
 const [path,sha]=fixed[name],b=readFileSync(join(root,path));
 assert.equal(gitBlob(b),sha,'canonical07 source lock mismatch: '+path);
 return {path,bytes:b,source:b.toString('utf8'),codepoints:[...b.toString('utf8')].length};
}
function contract(){
 const all=Object.fromEntries(Object.keys(fixed).map(k=>[k,locked(k)]));
 const reg=JSON.parse(all.registry.source),work=reg.workloads[6];
 assert.equal(reg.workloads.length,20);
 assert.equal(work.id,'07-file-conversion');
 assert.equal(work.acceptance,'read a file, convert content, write destination and verify bytes');
 assert.deepEqual(work.requiredCapabilities,['filesystem-read','filesystem-write']);
 assert.equal(work.status,'unsupported');assert.equal(work.evidence,null);
 assert.match(all.hc.source,/⧄⌨/);assert.match(all.hc.source,/⧇⦃/);
 assert.match(all.hc.source,/⤒rows/);assert.match(all.hc.source,/⧅\("converted.json",json\)/);
 return all;
}
function workdir(name,source){
 const tmp=mkdtempSync(join(tmpdir(),'hcode-canonical07-'));
 mkdirSync(join(tmp,'data','canonical07'),{recursive:true});
 const dir=join(tmp,'data','canonical07');
 writeFileSync(join(dir,name),source);
 const out=join(tmp,'out');mkdirSync(out);
 return {tmp,dir,out,input:'canonical07/'+name,clean:()=>rmSync(tmp,{recursive:true,force:true})};
}
function compile(hc){
 const tmp=mkdtempSync(join(tmpdir(),'hcode07-compile-'));
 const dest=join(tmp,'converter.mjs');
 const r=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
  '--','build',join(root,hc.path),'--out',dest],{
  cwd:root,encoding:'utf8',windowsHide:true,timeout:180000
 });
 if(r.error||r.status!==0){rmSync(tmp,{recursive:true,force:true});throw Error('Rust compiler: '+(r.error?.message||r.stderr));}
 const bytes=readFileSync(dest),js=bytes.toString('utf8');
 assert.match(js,/__hc_csv_read_file/);assert.match(js,/__hc_csv_typed/);
 assert.match(js,/__hc_json_write/);assert.match(js,/__hc_file_write/);
 assert.match(js,/linkSync\(/);
 return {tmp,dest,size:bytes.length,sha:createHash('sha256').update(bytes).digest('hex'),close:()=>rmSync(tmp,{recursive:true,force:true})};
}
async function nodeRun(args,dir,input,out,opts={}){
 return await new Promise((resolve,reject)=>{
  const env={...process.env,HCODE_FILE_WRITE_ROOT:out,HCODE_ALLOW_FILE_READ:'1',...opts.env};
  const child=spawn(process.execPath,args,{
   cwd:dir,windowsHide:true,env,stdio:['pipe','pipe','pipe']
  });
  let stdout='',stderr='',timedOut=false,done=false;
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  const timer=setTimeout(()=>{timedOut=true;child.kill();},opts.timeout??12000);
  child.once('error',e=>{if(done)return;done=true;clearTimeout(timer);reject(e);});
  child.once('close',(code,signal)=>{
    if(done)return;done=true;clearTimeout(timer);
    resolve({code,signal,stdout:stdout.replace(/\r\n/g,'\n'),stderr,timedOut});
  });
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
const expectedProducts='[{"active":true,"name":"Flise","quantity":15},{"active":false,"name":"Møbel, blå","quantity":2},{"active":true,"name":"A \\"quoted\\" product","quantity":0}]';
const expectedUnicode='[{"active":true,"name":"東京 🧩","quantity":3},{"active":false,"name":"Mañana","quantity":0}]';
function generatedCases(){
 const cases=[];
 for(let i=0;i<18;i++){
  const rows=Array.from({length:(i*3)%23},(_,j)=>{
   const title=(j%3===0?'X,"quoted"':j%3===1?'东京 🧩':'Møbel-'+i+'-'+j);
   const name='"'+title.replaceAll('"','""')+'"';
   return name+','+(i*j%100)+','+((i+j)%2===0?'true':'false');
  });
  const headers=i%2===0?'name,quantity,active':'quantity,active,name';
  const body=rows.map(row=>{
    if(i%2===0)return row;
    // Move CSV fields without corrupting the double-quoted first column.
    const end=row.lastIndexOf('",'); const rest=row.slice(end+2).split(',');
    return rest[0]+','+rest[1]+','+row.slice(0,end+1);
  });
  cases.push({id:'generated-'+i,name:'v'+i+'.csv',
    csv:headers+'\n'+body.join('\n')+(body.length?'\n':'')});
 }
 return cases;
}
async function runCase(caseData,built,all,{positive=true,expect=null}={}){
 const {name,csv}=caseData;
 const output={};
 for(const engine of ['rust','reference','typescript']){
  const d=workdir(name,csv);
  try{
    if(engine==='reference'){
      const events=[],cap=createFileWriteCapability({root:d.out});
      const lines=[];
      try{
       const stats=await executeAsync(all.hc.source,{
        readStdin:()=>d.input,
        readFile:path=>{
          if(path!==d.input)throw Error('Incorrect trusted CSV read path');
          return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(readFileSync(join(d.dir,name)));
        },
        fileWrite:(file,data)=>{events.push(file);return cap.write(file,data)},
        stdout:x=>lines.push(String(x))
       });
       output[engine]={code:0,stdout:lines.join('\n')+'\n',stats};
       assert.equal(stats.fileWrites,1,'JS journal failed to record only one output');
       assert.deepEqual(events,['converted.json']);
      }catch(e){output[engine]={code:1,error:e};}
    }else{
     const args=engine==='rust'?[built.dest]:['--experimental-strip-types',join(root,all.ts.path)];
     output[engine]=await nodeRun(args,d.tmp,d.input,d.out);
    }
    if(positive){
      assert.equal(output[engine].code,0,caseData.id+' '+engine+': '+(output[engine].stderr||output[engine].error));
      const written=readFileSync(join(d.out,'converted.json'));
      if(expect!==null)assert.deepEqual(written,Buffer.from(expect),caseData.id+' '+engine+' bytes');
      const printed=String(written.length)+'\n';
      assert.equal(output[engine].stdout,printed,caseData.id+' '+engine+' accurate byte count');
      assert.equal(readdirSync(d.out).length,1,'temp files leaked in '+engine);
      output[engine].actual=written;
    }else{
      assert.notEqual(output[engine].code,0,caseData.id+' '+engine+' incorrectly accepted invalid CSV');
      assert.equal(existsSync(join(d.out,'converted.json')),false,caseData.id+' '+engine+' partial output');
      assert.deepEqual(readdirSync(d.out),[],'temp files leaked on invalid input');
    }
  }finally{d.clean();}
 }
 if(positive){
   assert.deepEqual(output.rust.actual,output.typescript.actual,caseData.id+' Rust vs TS byte mismatch');
   assert.deepEqual(output.reference.actual,output.typescript.actual,caseData.id+' JS reference vs TS byte mismatch');
 }
 return output;
}
const invalids=[
  {id:'bad-number',name:'bad.csv',csv:'name,quantity,active\nX,NaN,true\n'},
  {id:'bad-bool',name:'bad.csv',csv:'name,quantity,active\nX,2,yes\n'},
  {id:'bad-header',name:'bad.csv',csv:'missing,quantity,active\nX,2,true\n'},
  {id:'missing-column',name:'bad.csv',csv:'name,quantity,active\nX,2\n'},
  {id:'invalid-quote',name:'bad.csv',csv:'name,quantity,active\n"X,2,true\n'}
];
test('original canonical07: exact frozen CSV conversion and 18 generated datasets in Rust/JS/TypeScript',async()=>{
 const all=contract(),built=compile(all.hc);
 console.log('CANONICAL07_GENERATED_JS_BYTES='+built.size);
 console.log('CANONICAL07_GENERATED_JS_SHA256='+built.sha);
 try{
  const fixtures=[
   {id:'products',name:'products.csv',csv:all.products.bytes,expect:expectedProducts},
   {id:'unicode',name:'unicode.csv',csv:all.unicode.bytes,expect:expectedUnicode},
   {id:'empty',name:'empty.csv',csv:all.empty.bytes,expect:'[]'},
  ];
  for(const f of fixtures)await runCase(f,built,all,{expect:f.expect});
  for(const c of generatedCases())await runCase(c,built,all);
  for(const bad of invalids)await runCase(bad,built,all,{positive:false});
  await runCase({id:'original-malformed',name:'bad.csv',csv:all.malformed.bytes},built,all,{positive:false});
  assert.ok(all.hc.codepoints<all.ts.codepoints,'task07 source not shorter than correctness oracle');
 }finally{built.close();}
});
test('write capability refuses missing grant, prevents overwrite and leaves original bytes untouched',async()=>{
 const all=contract(),built=compile(all.hc),d=workdir('data.csv',all.products.bytes);
 try{
  const denied=await nodeRun([built.dest],d.tmp,d.input,d.out,{env:{HCODE_FILE_WRITE_ROOT:''}});
  assert.notEqual(denied.code,0);assert.match(denied.stderr,/explicitly approved absolute output directory/);
  assert.equal(readdirSync(d.out).length,0);
  const ok=await nodeRun([built.dest],d.tmp,d.input,d.out);
  assert.equal(ok.code,0,ok.stderr);
  const prior=readFileSync(join(d.out,'converted.json'));
  const repeat=await nodeRun([built.dest],d.tmp,d.input,d.out);
  assert.notEqual(repeat.code,0);assert.match(repeat.stderr,/EEXIST/);
  assert.deepEqual(readFileSync(join(d.out,'converted.json')),prior);
  assert.deepEqual(readdirSync(d.out),['converted.json']);
 }finally{built.close();d.clean();}
});
test('real compiler rejects 64KiB output overflow and symlink target without clobber',async()=>{
 const all=contract(),built=compile(all.hc);
 const d=workdir('data.csv',all.products.bytes);
 try{
  const large=Array.from({length:5000},(_,i)=>'"Unicode 🧩 '+i+'",1,true').join('\n');
  // More than 64KiB output is valid CSV, but exceeds the writer's output cap.
  writeFileSync(join(d.dir,'big.csv'),'name,quantity,active\n'+large+'\n');
  const overflow=await nodeRun([built.dest],d.tmp,'canonical07/big.csv',d.out);
  assert.notEqual(overflow.code,0);
  assert.match(overflow.stderr,/output exceeds 64 KiB UTF-8|CSV too many records|CSV field too long/);
  assert.equal(readdirSync(d.out).length,0);
  const outside=join(d.tmp,'outside.txt');writeFileSync(outside,'untouched');
  symlinkSync(outside,join(d.out,'converted.json'));
  const symlink=await nodeRun([built.dest],d.tmp,d.input,d.out);
  assert.notEqual(symlink.code,0);assert.match(symlink.stderr,/EEXIST/);
  assert.equal(readFileSync(outside,'utf8'),'untouched');
  assert.equal(readdirSync(d.out).length,1);
 }finally{built.close();d.clean();}
});
