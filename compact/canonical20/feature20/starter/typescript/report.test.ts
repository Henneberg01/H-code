import assert from 'node:assert/strict';
import test from 'node:test';
import {cases} from './fixtures.ts';
import {report, positiveReport} from './report.ts';

for (const c of cases) {
  test(`report: ${c.id}`, () => {
    const original = JSON.stringify(c.values);
    assert.equal(report(c.values), c.summary);
    assert.equal(positiveReport(c.values), c.positive);
    assert.equal(JSON.stringify(c.values), original);
  });
}
