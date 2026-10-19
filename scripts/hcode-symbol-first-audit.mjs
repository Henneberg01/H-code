// Audit all H-Code source files; enforce sign-first only for new active M19.15.
// Historical frozen source and accessible ASCII fixtures are never rewritten.
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const byteLength=s=>Buffer.byteLength(s,'utf8');
const sha=s=>createHash('sha1').update('blob '+byteLength(s)+'\0').update(s).digest('hex');
// Immutable inventory freezes every historical .hc Git-blob. Unchanged historical
// programs stay available, including intentional ASCII keyboards/accessibility.
const legacyLock=JSON.parse(readFileSync(join(root,'docs/H-CODE-LEGACY-SOURCE-LOCK.json'),'utf8'));
if(legacyLock.schema!==1||legacyLock.baseCommit!=='d6c1ab61ec7996b1defb01e09fd49b53479d4580')
  throw Error('H-Code historical source lock format or provenance mismatch');
const legacyFiles=new Map(legacyLock.files.map(item=>[item.path,item.gitBlob]));
if(legacyFiles.size!==legacyLock.files.length||legacyFiles.size<100)
  throw Error('H-Code legacy source lock contains duplicates or missing fixtures');
export const activeSources=Object.freeze([
  'compact/canonical20/programs/15-db-query-b1.hc',
  'compact/canonical20/programs/15-db-dashboard-b2b.hc',
  'compact/canonical20/programs/15-generic-table-b2a.hc',
  'compact/canonical20/programs/15-db-dashboard-ui.hc'
]);
export function codeOnly(src){
  return src.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    match=>'\n'.repeat((match.match(/\n/g)||[]).length)+' ');
}
const fallback=/\b(?:print|db_rows|dom_table|fn|let|return|if|else|while|json_in|json_out)\b|@(?:\+|\?|>|v)/g;
export function inspect(path){
  const source=readFileSync(join(root,path),'utf8'),code=codeOnly(source);
  return {path,codepoints:[...source].length,utf8Bytes:byteLength(source),
   gitBlob:sha(source),fallbacks:[...code.matchAll(fallback)].map(m=>m[0])};
}
function collect(dir='.'){
  let paths=[];
  for(const item of readdirSync(join(root,dir),{withFileTypes:true})){
    if(['.git','node_modules','target','dist','.next'].includes(item.name))continue;
    const name=join(dir,item.name);
    if(item.isDirectory())paths.push(...collect(name));
    else if(item.isFile()&&item.name.endsWith('.hc'))
      paths.push(relative(root,join(root,name)).replaceAll('\\','/'));
  }
  return paths;
}
export function audit(){
  const all=collect().sort(),newSet=new Set(activeSources);
  const byPath=new Map(all.map(path=>[path,inspect(path)]));
  const changed=all.filter(path=>
    newSet.has(path)||!legacyFiles.has(path)||legacyFiles.get(path)!==byPath.get(path).gitBlob);
  const failing=changed.flatMap(path=>byPath.get(path).fallbacks.map(word=>({path,word})));
  // Every new or modified program is checked, irrespective of directory.
  // Historical SHA-locked .ascii.hc files remain exactly as preserved.
  return {scanned:all.length,active:all.filter(x=>newSet.has(x)),
    changedOrNew:changed,preserved:all.length-changed.length,
    legacyCount:legacyFiles.size,failing};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=audit();
  for(const path of result.active){
    const item=inspect(path);
    console.log(path+': '+item.codepoints+' codepoints, '+item.utf8Bytes+' UTF-8 bytes');
  }
  console.log(JSON.stringify(result));
  if(result.failing.length)process.exitCode=1;
}
