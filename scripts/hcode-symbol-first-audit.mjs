// Audit all H-Code source files; enforce sign-first only for new active M19.15.
// Historical frozen source and accessible ASCII fixtures are never rewritten.
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const byteLength=s=>Buffer.byteLength(s,'utf8');
const sha=s=>createHash('sha1').update('blob '+byteLength(s)+'\0').update(s).digest('hex');
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
  const failing=activeSources.flatMap(path=>inspect(path).fallbacks.map(word=>({path,word})));
  return {scanned:all.length,active:all.filter(x=>newSet.has(x)),
    preserved:all.filter(x=>!newSet.has(x)).length,failing};
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
