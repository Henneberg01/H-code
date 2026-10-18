import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyCanonical02,FROZEN} from '../canonical20-verify-02.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('original Fibonacci M10 source remains byte-for-byte frozen and its source-size regression is visible',()=>{
  for(const [key,[path,sha]] of Object.entries(FROZEN)){
    const bytes=readFileSync(new URL('../../'+path,import.meta.url));
    const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(actual,sha,key+' SHA changed');
  }
  assert.equal(FROZEN.hc[1],'66f02e2dce678b51f8d02766742d9d24aa5d66f7');
  assert.equal(FROZEN.ts[1],'2a4e6ac1ef469a6e0c64381b79f901ee26085125');
});
test('complete Fibonacci proof checks compiler, recursion, TS, JS and a separate shortened source',{
  skip:Number(process.versions.node.split('.')[0])<22
},()=>{
  const result=verifyCanonical02();
  assert.equal(result.kind,'full-compiler-evidence');
  assert.equal(result.originalM10SourceUnchanged,true);
  assert.equal(result.fixedAcceptanceN,7);
  assert.equal(result.fixedAcceptanceOutput,'13\n');
  assert.equal(result.positiveCasesVerified,16);
  assert.equal(result.compilerStaticTypeFailuresVerified,3);
  assert.equal(result.stdoutParityOnAllPositiveCases,true);
  assert.equal(result.compilerGeneratedExecutionVerified,true);
  assert.equal(result.hcodeDeveloperAuthored.unicodeCodepoints,96);
  assert.equal(result.hcodeDeveloperAuthored.utf8Bytes,105);
  assert.equal(result.typescriptDeveloperAuthored.unicodeCodepoints,94);
  assert.equal(result.typescriptDeveloperAuthored.utf8Bytes,94);
  assert.equal(result.unicodeCodepointReductionPct,-2.13); // a true regression
  assert.equal(result.symbolFirstAlternate.NOT_AN_AUTOMATIC_REPLACEMENT_FOR_ORIGINAL_FROZEN_M10,true);
  assert.equal(result.symbolFirstAlternate.authoredUnicodeCodepoints,64);
  assert.equal(result.symbolFirstAlternate.unicodeCodepointReductionPctVsSameFrozenTS,31.91);
  assert.equal(result.symbolFirstAlternate.validatedSame16CasesWithRustAndJS,true);
  assert.equal(result.twentyTaskGlobalMedian,null);
  assert.equal(result.seventyPercentGlobalTargetVerified,false);
});
