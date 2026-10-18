import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTypedJson} from '../m12-typed-json-compare.mjs';

test('the native ⤓⤒ JSON case is actually output-matched and independently hash locked',{
  skip:Number(process.versions.node.split('.')[0])<22
},()=>{
  const p=compareTypedJson();
  assert.equal(p.parityValidated,true);
  assert.equal(p.sourceFrozen,true);
  assert.equal(p.hcode.unicodeCodepoints,93);
  assert.equal(p.typescript.unicodeCodepoints,637);
  assert.equal(p.unicodeCodepointSavingsPercent,85.4);
  assert.equal(p.generatedJsRuntimeBytesMeasured,false);
  assert.equal(p.globalTwentyWorkloadCodepointMedian,null);
  assert.equal(p.seventyPercentGlobalGoalVerified,false);
  assert.equal(p.historicM14ThreeCaseMedianCodepointSavings,68.46);
});
