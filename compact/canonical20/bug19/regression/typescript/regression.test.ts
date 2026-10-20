import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import type {cases} from './fixtures.ts';
import {summarize, positiveSummary} from './statistics.ts';
import {report, positiveReport} from './report.ts';

const regression: typeof cases = JSON.parse(
  readFileSync(new URL('./data/regression.json', import.meta.url), 'utf8'));

for (const c of regression) {
  test(`regression: ${c.id}`, () => {
    const original = JSON.stringify(c.values);
    assert.equal(JSON.stringify(summarize(c.values)), c.summary);
    assert.equal(JSON.stringify(positiveSummary(c.values)), c.positive);
    assert.equal(report(c.values), c.summary);
    assert.equal(positiveReport(c.values), c.positive);
    assert.equal(JSON.stringify(c.values), original);
  });
}
