#!/usr/bin/env node
// Local-test compatibility launcher. All DOM evidence comes from real Chromium.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dumpDOM} from './chromium-driver.mjs';
const binary=process.env.HCODE_CHROME_BINARY||'/usr/bin/chromium';
if(realpathSync(binary)===realpathSync(fileURLToPath(import.meta.url)))throw Error('Chromium launcher cannot invoke itself');
if(process.argv.includes('--version')){
 const result=spawnSync(binary,['--version'],{encoding:'utf8',timeout:10000,windowsHide:true});
 if(result.error)throw result.error;process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exitCode=result.status??2;
}else{
 const args=process.argv.slice(2),url=args.find(value=>/^https?:\/\//.test(value));
 if(!args.includes('--dump-dom')||!url)throw Error('Chromium proof launcher requires --dump-dom and a local URL');
 const profileArg=args.find(value=>value.startsWith('--user-data-dir='));
 const owned=!profileArg,profile=owned?mkdtempSync(join(tmpdir(),'jfh-chromium-profile-')):profileArg.slice('--user-data-dir='.length);
 const budgetArg=args.find(value=>value.startsWith('--virtual-time-budget='));
 const virtualTimeBudget=budgetArg?Number(budgetArg.slice('--virtual-time-budget='.length)):5000;
 const forwarded=args.filter(value=>value!==url&&value!=='--dump-dom'&&!value.startsWith('--user-data-dir=')&&!value.startsWith('--virtual-time-budget=')&&!value.startsWith('--remote-debugging-'));
 try{process.stdout.write(await dumpDOM({binary,url,profile,virtualTimeBudget,args:forwarded}));}
 finally{if(owned)rmSync(profile,{recursive:true,force:true});}
}
