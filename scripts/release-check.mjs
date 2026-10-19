import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const required=['LICENSE','NOTICE','LICENSING.md','TRADEMARKS.md','COMMERCIAL.md','SECURITY.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','README.md','JFH-CODE-PRINCIPLES.md','RELEASE_NOTES.md','docs/RELEASING.md','compiler/Cargo.toml','compiler/package.json','package.json','studio/server.mjs','studio/public/index.html'];
let problems=[];for(const p of required){if(!fs.existsSync(path.join(root,p)))problems.push('Missing '+p)}
const read=p=>fs.existsSync(path.join(root,p))?fs.readFileSync(path.join(root,p),'utf8'):'';
const license=read('LICENSE');
if(!license.startsWith('JFH-CODE — Commercial License')||!license.includes('All rights reserved')||
   !license.includes('paid commercial agreement')||!license.includes('No free community'))
  problems.push('Commercial license required: JFH-CODE requires a paid agreement and grants no free use');
for(const file of ['package.json','compiler/package.json']){
  try{if(JSON.parse(read(file)).license!=='UNLICENSED')problems.push(file+' must use UNLICENSED');}
  catch{problems.push('Invalid package metadata: '+file);}
}
if(!/^license-file\s*=\s*"\.\.\/LICENSE"\s*$/m.test(read('compiler/Cargo.toml'))||
   /^license\s*=/m.test(read('compiler/Cargo.toml')))
  problems.push('Compiler must point to the commercial LICENSE');
if(!/^# JFH-CODE\r?\n/.test(read('README.md')))problems.push('README must use the JFH-CODE name');
if(!read('studio/public/index.html').includes('<title>JFH-CODE Studio</title>'))
  problems.push('Studio must use the JFH-CODE name');
const notice=fs.readFileSync(path.join(root,'NOTICE'),'utf8');if(!notice.includes('Jonas Fogh Henneberg')||!notice.includes('Fastsell.net'))problems.push('NOTICE owner missing');
const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');if(!ignore.includes('compiler/target/')||!ignore.includes('.env'))problems.push('Ignore rules incomplete');
const walk=(dir,level=0)=>{if(level>10)return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name==='.git'||item.name==='node_modules'||item.name==='target'||item.name.startsWith('.m9-backup'))continue;const rel=path.relative(root,path.join(dir,item.name)).replaceAll('\\','/');if(item.isDirectory())walk(path.join(dir,item.name),level+1);else if(item.isFile()&&/\.(?:js|mjs|rs|json|hc|md|yaml|yml|toml)$/i.test(item.name)){const s=fs.readFileSync(path.join(dir,item.name),'utf8');if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(s)||/sk-proj-[a-zA-Z0-9_-]{20,}/.test(s))problems.push('Potential credential '+rel);}}};walk(root);
if(problems.length){for(const problem of problems)console.error(problem);process.exitCode=1}else console.log('JFH-CODE release checks PASS: commercial license, branding, source inventory, ignore rules and basic secret patterns');
