import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const required=['LICENSE','NOTICE','TRADEMARKS.md','COMMERCIAL.md','SECURITY.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','README.md','RELEASE_NOTES.md','docs/RELEASING.md','docs/PROJECT_CONTINUITY.md','compiler/Cargo.toml','studio/server.mjs'];
let problems=[];for(const p of required){if(!fs.existsSync(path.join(root,p)))problems.push('Missing '+p)}
const license=fs.readFileSync(path.join(root,'LICENSE'),'utf8');if(!license.includes('Apache License')||!license.includes('Version 2.0'))problems.push('LICENSE not Apache-2.0');
const notice=fs.readFileSync(path.join(root,'NOTICE'),'utf8');if(!notice.includes('Jonas Fogh Henneberg')||!notice.includes('Fastsell.net'))problems.push('NOTICE owner missing');
const excludes=['compiler/target','node_modules','.env','studio/output.mjs'];
const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');if(!ignore.includes('compiler/target/')||!ignore.includes('.env'))problems.push('Ignore rules incomplete');
const walk=(dir,level=0)=>{if(level>10)return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name==='.git'||item.name==='node_modules'||item.name==='target'||item.name.startsWith('.m9-backup'))continue;const rel=path.relative(root,path.join(dir,item.name)).replaceAll('\\','/');if(item.isDirectory())walk(path.join(dir,item.name),level+1);else if(item.isFile()&&/\.(?:js|mjs|rs|json|hc|md|yaml|yml|toml)$/i.test(item.name)){const s=fs.readFileSync(path.join(dir,item.name),'utf8');if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(s)||/sk-proj-[a-zA-Z0-9_-]{20,}/.test(s))problems.push('Potential credential '+rel);}}};walk(root);
if(problems.length){for(const problem of problems)console.error(problem);process.exitCode=1}else console.log('M9 release checks PASS: legal files, source inventory, ignore rules and basic secret patterns');
