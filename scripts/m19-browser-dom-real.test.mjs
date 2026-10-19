import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const dir=()=>mkdtempSync(join(tmpdir(),'hcode13-real-browser-'));
const form=readFileSync(join(root,'compact/canonical20/programs/13-form-validation-ui.html'),'utf8');
const script=String.raw`<script>
window.addEventListener('load',()=>{
  try{
    const email=document.querySelector('#email');
    const status=document.querySelector('#email-error');
    const preview=document.querySelector('#email-preview');
    const form=document.querySelector('#contact-form');
    email.value='bad';
    email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    const denied=new Event('submit',{bubbles:true,cancelable:true});
    form.dispatchEvent(denied);
    const invalid=denied.defaultPrevented&&
      email.getAttribute('aria-invalid')==='true'&&
      status.textContent==='Enter a valid email address'&&
      preview.textContent==='bad';
    email.value='<img src=x onerror=alert(1)>';
    email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    const safe=preview.textContent===email.value&&
      preview.innerHTML.includes('&lt;img')&&
      document.querySelector('img')===null;
    email.value='person@example.org';
    email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    const accepted=new Event('submit',{bubbles:true,cancelable:true});
    form.dispatchEvent(accepted);
    const valid=!accepted.defaultPrevented&&
      email.getAttribute('aria-invalid')==='false'&&
      status.textContent===''&&
      preview.textContent==='person@example.org';
    const marker=document.createElement('output');
    marker.id='hcode-browser-proof';
    marker.textContent=encodeURIComponent(JSON.stringify({invalid,safe,valid}));
    document.body.append(marker);
  }catch(error){
    const marker=document.createElement('output');
    marker.id='hcode-browser-proof';
    marker.textContent=encodeURIComponent(JSON.stringify({error:String(error)}));
    document.body.append(marker);
  }
},{once:true});
</script>`;
function chromeBinary(){
 return process.env.HCODE_CHROME||process.env.CHROME_BIN||
    (process.platform==='win32'?'chrome':'google-chrome');
}
async function launchChrome(binary,url,dataRoot){
 const args=['--headless=new','--disable-gpu','--no-first-run','--no-sandbox',
  '--disable-dev-shm-usage','--virtual-time-budget=5000',
  '--user-data-dir='+dataRoot,'--dump-dom',url];
 const child=spawn(binary,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const result=await new Promise((resolve,reject)=>{
  let stdout='',stderr='',done=false;
  const deadline=setTimeout(()=>finish(Error('Headless Chrome timeout: '+stderr.slice(-2000))),30000);
  function finish(error,value){
    if(done)return;done=true;clearTimeout(deadline);
    if(error){child.kill('SIGKILL');reject(error);}else resolve(value);
  }
  child.on('error',finish);
  child.stdout.on('data',b=>{
   stdout+=String(b);if(stdout.length>2*1024*1024)finish(Error('Unexpected Chrome output size'));
  });
  child.stderr.on('data',b=>{if(stderr.length<16384)stderr+=String(b);});
  child.on('exit',code=>code===0?finish(null,stdout):
    finish(Error('Chrome exit '+code+': '+stderr.slice(-3000))));
 });
 return result;
}
test('real Chromium loads Rust-generated H-Code ESM and validates live DOM input/submit events',async()=>{
 const temp=dir();
 let server;
 try{
  const out=join(temp,'13-form-validation-ui.mjs');
  const build=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',join(root,'compact/canonical20/programs/13-form-validation-ui.hc'),'--out',out],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:180000
  });
  assert.equal(build.status,0,build.stderr||build.stdout||String(build.error));
  const js=readFileSync(out);
  assert.ok(js.length>0);
  server=createServer((req,res)=>{
    if(req.url==='/13-form-validation-ui.mjs'){
      res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
      res.end(js);return;
    }
    if(req.url==='/13-form-validation-ui.html'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      res.end(form.replace('</body>',script+'</body>'));return;
    }
    res.writeHead(404);res.end('not found');
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  const address=server.address();
  assert.ok(address&&typeof address!=='string');
  const html=await launchChrome(chromeBinary(),
    'http://127.0.0.1:'+address.port+'/13-form-validation-ui.html',join(temp,'browser'));
  const found=/<output id="hcode-browser-proof">([^<]+)<\/output>/.exec(html);
  assert.ok(found,'Real browser did not produce a DOM proof marker: '+html.slice(-2000));
  const report=JSON.parse(decodeURIComponent(found[1].replaceAll('&amp;','&')));
  assert.deepEqual(report,{invalid:true,safe:true,valid:true});
 }finally{
  if(server)await new Promise(resolve=>server.close(()=>resolve()));
  rmSync(temp,{recursive:true,force:true});
 }
});
