// Independent functional TypeScript reference for fixed canonical08.
// This is a correctness oracle, not a competitively selected TS baseline.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export type HttpResult={body:string;ok:boolean;retryAfter:number;status:number};
export async function parallelGet(urls:string[]):Promise<HttpResult[]>{
  if(!Array.isArray(urls)||urls.length>16||!urls.every(v=>typeof v==='string'))
    throw new TypeError('At most 16 URL strings expected');
  for(const raw of urls){
    const url=new URL(raw);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)
      throw new TypeError('HTTP(S) URL without embedded credentials required');
  }
  return await Promise.all(urls.map(async raw=>{
    try{
      const response=await fetch(raw,{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(2000)
      });
      const body=await response.text();
      const header=response.headers.get('retry-after');
      const seconds=header!==null&&/^\d+$/.test(header)?Number(header):0;
      const retryAfter=Number.isSafeInteger(seconds)&&seconds<=120?seconds*1000:0;
      return {body,ok:response.ok,retryAfter,status:response.status};
    }catch{
      return {body:'',ok:false,retryAfter:0,status:0};
    }
  }));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const urls=JSON.parse(readFileSync(0,'utf8')) as string[];
 console.log(JSON.stringify(await parallelGet(urls)));
}
