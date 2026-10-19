// M1 OFFLINE locked package loader: no network, eval, dynamic JS import or runtime privileges.
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,relative,resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {parse,RESERVED_USER_GLYPHS,CORE_GLYPHS} from './hcode.mjs';
import {contractType,validatePurePackageV2,validatePurePackageV3} from './package-v2-types.mjs';
import {verifyGenericManifestOperation,normalizeBinders} from './package-v3-signatures.mjs';

const IDENT=/^[A-Za-z_][A-Za-z0-9_]*$/;
const PACKAGE=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HEX=/^[a-f0-9]{64}$/;
const TYPES=new Set(['Number','String','Bool','Unit']);
const KEYWORDS=new Set(['fn','let','return','true','false','if','else','while','and','or','not','use','as','import','export','lambda','forall','json_in','json_valid','json_out','dom_value','dom_text','dom_valid','dom_on','dom_attr']);
const MAX_BYTES=1024*1024;
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const must=(condition,message)=>{if(!condition)throw Error(`Invalid H-Code package: ${message}`);};
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

function readLocal(parent,path){
  must(typeof path==='string'&&path.length>0&&path.split('/').every(x=>x!==''&&x!=='.'&&x!=='..')&&
    !isAbsolute(path)&&!path.includes('\\')&& !path.includes(':'),'unsafe package path');
  const realParent=realpathSync(parent),realFile=realpathSync(resolve(realParent,path));
  const rel=relative(realParent,realFile);
  must(rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel),'package path escapes its directory');
  must(statSync(realFile).size<=MAX_BYTES,'package file exceeds 1 MiB');
  return {path:realFile,bytes:readFileSync(realFile)};
}
function parseJson(buffer,label){
  try{return JSON.parse(buffer.toString('utf8'));}catch{throw Error(`Invalid H-Code package: ${label} is not valid JSON`);}
}
function signature(fn,op,key){
  must(JSON.stringify(fn.typeParameters??[])===JSON.stringify(op.typeParameters??[]),`${key}: ∀ binder mismatch`);
  must(fn.params.length===op.parameters.length,`${key}: mismatched argument count`);
  for(let i=0;i<op.parameters.length;i++){
    must(fn.params[i].type===op.parameters[i].type,`${key}: function parameter type mismatch at ${i+1}`);
    must(fn.params[i].name===op.parameters[i].name,`${key}: function parameter name mismatch at ${i+1}`);
  }
  must(fn.returnType===op.returns,`${key}: return type mismatch`);
}
function validateManifest(manifest,ast){
  must(isRecord(manifest)&&[1,2,3].includes(manifest.format),'manifest format must be 1, 2 or 3');
  must(PACKAGE.test(manifest.name??''),'invalid package name');
  must(VERSION.test(manifest.version??''),'invalid semantic version');
  must(typeof manifest.source==='string'&&/^[a-zA-Z0-9_-]+\.hc$/.test(manifest.source),'source must be a local .hc filename');
  must(Array.isArray(manifest.operations)&&manifest.operations.length>0&&manifest.operations.length<=100,'invalid operations');
  const functions=new Map();
  for(const s of ast.body){
    must(s.kind==='Function','only top-level functions are permitted in a pure M1 library');
    must(!functions.has(s.name),`duplicate function ${s.name}`);
    functions.set(s.name,s);
  }
  const names=new Set(),glyphs=new Set();
  for(const op of manifest.operations){
    must(isRecord(op),'operation must be an object');
    must(IDENT.test(op.name??'')&&!KEYWORDS.has(op.name),`invalid operation name ${op.name}`);
    must(!names.has(op.name),`duplicate operation ${op.name}`);names.add(op.name);
    must(!RESERVED_USER_GLYPHS.has(op.glyph)&&!Object.hasOwn(CORE_GLYPHS,op.glyph),`reserved core glyph ${op.glyph}`);
    must(typeof op.glyph==='string'&&[...op.glyph].length===1&&/^\p{S}$/u.test(op.glyph),'glyph must be a single Unicode symbol');
    must(op.glyph.normalize('NFC')===op.glyph&&op.glyph.normalize('NFKC')===op.glyph,'glyph is not stable under Unicode normalization');
    must(!glyphs.has(op.glyph),`duplicate glyph ${op.glyph}`);glyphs.add(op.glyph);
    must(Array.isArray(op.parameters)&&op.parameters.length<=32,'parameters must be an array (max 32)');
    const binders=manifest.format===3?normalizeBinders(op.typeParameters??[]):[];
    must(manifest.format===3||!(op.typeParameters?.length),'∀ requires manifest format 3');
    const params=new Set();
    for(const p of op.parameters){
      must(isRecord(p)&&IDENT.test(p.name??'')&&!KEYWORDS.has(p.name),`${op.name}: invalid typed parameter`);
      if(manifest.format===1)must(TYPES.has(p.type),`${op.name}: invalid typed parameter`);
      else contractType(p.type,manifest.format,0,binders);
      must(!params.has(p.name),`${op.name}: duplicate parameter ${p.name}`);params.add(p.name);
    }
    if(manifest.format===1)must(TYPES.has(op.returns),`${op.name}: unsupported return type`);
    else contractType(op.returns,manifest.format,0,binders);
    if(manifest.format===3)verifyGenericManifestOperation(op);
    must(Array.isArray(op.effects)&&op.effects.length===0,`${op.name}: M1 supports only pure operations (effects: [])`);
    must(typeof op.implementation==='string'&&IDENT.test(op.implementation)&&!KEYWORDS.has(op.implementation),`${op.name}: invalid implementation name`);
    const fn=functions.get(op.implementation);
    must(fn,`${op.name}: implementation ${op.implementation} was not found`);
    signature(fn,op,`${manifest.name}::${op.name}`);
  }
  if(manifest.format===2)validatePurePackageV2(ast,manifest);
  if(manifest.format===3)validatePurePackageV3(ast,manifest);
  return manifest;
}

export function loadLockedPackages(lockfilePath){
  const lockReal=realpathSync(lockfilePath);
  must(statSync(lockReal).size<=MAX_BYTES,'lockfile exceeds 1 MiB');
  const lock=parseJson(readFileSync(lockReal),'lockfile');
  must(isRecord(lock)&&lock.lockVersion===1,'unsupported lockfile version');
  must(Array.isArray(lock.packages),'lockfile packages must be an array');
  const registry=new Map();
  const projectRoot=dirname(lockReal);
  for(const entry of lock.packages){
    must(isRecord(entry)&&PACKAGE.test(entry.name??'')&&VERSION.test(entry.version??''),'invalid lock entry');
    must(HEX.test(entry.manifestSha256??'')&&HEX.test(entry.sourceSha256??''),'invalid sha256 digest');
    const key=`${entry.name}@${entry.version}`;
    must(!registry.has(key),`duplicate locked package ${key}`);
    const manifestFile=readLocal(projectRoot,entry.manifest);
    must(sha(manifestFile.bytes)===entry.manifestSha256,`${key}: manifest SHA-256 mismatch`);
    const manifest=parseJson(manifestFile.bytes,`${key} manifest`);
    must(manifest.name===entry.name&&manifest.version===entry.version,`${key}: manifest identity mismatch`);
    const sourceFile=readLocal(dirname(manifestFile.path),manifest.source);
    must(sha(sourceFile.bytes)===entry.sourceSha256,`${key}: source SHA-256 mismatch`);
    const ast=parse(sourceFile.bytes.toString('utf8'));
    validateManifest(manifest,ast);
    registry.set(key,{manifest,ast});
  }
  return registry;
}
