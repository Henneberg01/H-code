import assert from 'node:assert/strict';
import test from 'node:test';
import {cases} from './fixtures.ts';
import {summarize, positiveSummary} from './statistics.ts';

for (const c of cases) {
  test(`statistics: ${c.id}`, () => {
    const original = JSON.stringify(c.values);
    assert.equal(JSON.stringify(summarize(c.values)), c.summary);
    assert.equal(JSON.stringify(positiveSummary(c.values)), c.positive);
    assert.equal(JSON.stringify(c.values), original);
  });
}
