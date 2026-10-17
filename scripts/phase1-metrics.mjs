import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {parse,linkProgram,execute} from '../prototype/src/hcode.mjs';
import {loadLockedPackages} from '../prototype/src/packages.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'phase1','fixtures');
const allowedOutput='phase1/results/source-metrics.json';

export function measureSource(source){
 if(typeof source!=='string')throw new TypeError('source must be text');
 return {codePoints:Array.from(source).length,utf8Bytes:Buffer.byteLength(source,'utf8'),nonBlankLines:source.split(/\r?\n/u).filter(l=>l.trim().length>0).length};
}
export function measurePair(glyphSource,asciiSource){
 const glyph=measureSource(glyphSource),ascii=measureSource(asciiSource);
 if(!ascii.codePoints||!ascii.utf8Bytes)throw new Error('ASCII baseline must be nonempty');
 const percent=(a,b)=>Number(((b-a)/b*100).toFixed(2));
 return {glyph,ascii,changes:{codePointsPercent:percent(glyph.codePoints,ascii.codePoints),utf8BytesPercent:percent(glyph.utf8Bytes,ascii.utf8Bytes)}};
}
const stripLocations=v=>Array.isArray(v)?v.map(stripLocations):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='line'&&k!=='column').map(([k,val])=>[k,stripLocations(val)])):v;
const run=(source,registry)=>{
 const out=[];
 execute(source,{registry,stdout:line=>out.push(String(line))});
 return out.length?out.join('\n')+'\n':'';
};
function readFixture(name){
 if(!/^(functions|booleans|recursion|package)\.(glyph|ascii)\.hc$/u.test(name))throw new Error('Invalid fixture ID');
 const filename=path.join(dir,name);
 const real=fs.realpathSync(filename);
 if(path.dirname(real)!==fs.realpathSync(dir))throw new Error('Fixture cannot escape its directory');
 return fs.readFileSync(real,'utf8');
}
function buildReport(){
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 if(manifest.format!==1||!Array.isArray(manifest.pairs)||manifest.pairs.length!==4)throw new Error('Invalid fixtures manifest');
 const expected=['functions','booleans','recursion','package'];
 const pairs=manifest.pairs.map((entry,index)=>{
  const {id,lock,output}=entry;
  if(id!==expected[index]||typeof lock!=='boolean'||typeof output!=='string')throw new Error('Invalid fixture metadata');
  const glyph=readFixture(id+'.glyph.hc');
  const ascii=readFixture(id+'.ascii.hc');
  const registry=lock?loadLockedPackages(path.join(root,'hcode.lock.json')):new Map();
  assert.deepEqual(stripLocations(linkProgram(parse(glyph),registry)),stripLocations(linkProgram(parse(ascii),registry)),id+': different meanings');
  const actual=run(glyph,registry);
  if(actual!==output||run(ascii,registry)!==output)throw new Error(id+': output mismatch');
  return {id,...measurePair(glyph,ascii),outputVerified:true,generatedJsBytes:null,runtimeMs:null};
 });
 return {format:1,metric:'H-Code source compactness; negative percentages mean a regression',toolVersions:{node:process.version,platform:process.platform,arch:process.arch},meaningsVerified:true,aiTokens:null,developerTime:null,pairs};
}
function main(args){
 if(args.length!==0&&!(args.length===2&&args[0]==='--output'&&args[1]===allowedOutput)){
  throw new Error('Invalid output path or arguments. Usage: node scripts/phase1-metrics.mjs [--output '+allowedOutput+']');
 }
 const result=JSON.stringify(buildReport(),null,2)+'\n';
 if(args.length){
  const dest=path.join(root,...allowedOutput.split('/'));
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,result,{encoding:'utf8',flag:'w'});
 }
 process.stdout.write(result);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
}
