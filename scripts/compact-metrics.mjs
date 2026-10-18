// CSE-1 measurement: Unicode code points and UTF-8 bytes are separate metrics.
// This compares H-Code glyphs against semantically paired H-Code ASCII aliases,
// not against TypeScript. It must not be quoted as evidence of a 70% reduction.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export const sourceMetrics=source=>({
  codePoints:[...source].length,
  utf8Bytes:Buffer.byteLength(source,'utf8'),
  lines:source.split('\n').length-(source.endsWith('\n')?1:0),
  nonBlankLines:source.split('\n').filter(x=>x.trim()).length
});
export const reduction=(glyph,ascii)=>ascii===0?null:Number((100*(1-glyph/ascii)).toFixed(2));

export function measureCompactFixtures(base=root){
  const folder=join(base,'compact','fixtures');
  const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
  if(manifest.format!==1 || !Array.isArray(manifest.pairs))throw Error('Invalid CSE-1 fixture manifest');
  const results=manifest.pairs.map(({id,locked})=>{
    if(typeof id!=='string'||!/^[a-z0-9-]+$/.test(id))throw Error('Unsafe fixture name');
    const glyph=sourceMetrics(readFileSync(join(folder,id+'.glyph.hc'),'utf8'));
    const ascii=sourceMetrics(readFileSync(join(folder,id+'.ascii.hc'),'utf8'));
    return {id,locked,glyph,ascii,codePointReductionPercent:reduction(glyph.codePoints,ascii.codePoints),
      utf8ReductionPercent:reduction(glyph.utf8Bytes,ascii.utf8Bytes)};
  });
  return {kind:'H-Code glyph vs H-Code ASCII alias only',version:1,comparisonWithTypeScript:false,
    metric:'Unicode code points; UTF-8 bytes reported separately',results};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(measureCompactFixtures(),null,2));
}
