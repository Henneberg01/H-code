// Separate OS process test driver. No mocked filesystem or HTTP.
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
const store=createHttpCasStateStore({root:process.env.CAS_ROOT,initial:'0'});
const digest='a'.repeat(64);
const prefix=process.env.CAS_PREFIX||'worker';
const total=Number(process.env.CAS_TOTAL||1);
const outputs=[];
for(let i=0;i<total;i++){
  const id=process.env.CAS_SAME_ID||`${prefix}_${i}`;
  let ok=false;
  for(let attempts=0;attempts<2000;attempts++){
    const snapshot=store.snapshot();
    const previous=snapshot.receipts.find(x=>x.id===id);
    if(previous){
      if(previous.digest!==digest)throw Error('Conflicting request-id digest');
      outputs.push(previous.body);ok=true;break;
    }
    const next=String(Number(snapshot.state)+1);
    const receipt={id,digest,status:200,body:next};
    const outcome=store.tryCommit({expectedRevision:snapshot.revision,next,receipt});
    if(outcome.committed){outputs.push(next);ok=true;break;}
  }
  if(!ok)throw Error('CAS conflict retry exhausted');
}
if(process.env.CAS_KILL_SELF==='1'){
  process.kill(process.pid,'SIGKILL');
}else{
  process.stdout.write(JSON.stringify(outputs)+'\n');
  store.close();
}
