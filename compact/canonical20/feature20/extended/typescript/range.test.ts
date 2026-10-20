import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as stats from './statistics.ts';
import * as reports from './report.ts';

const ranges: {id: string; values: number[]; lower: number; upper: number; expected: string}[] =
  JSON.parse(readFileSync(new URL('./data/ranges.json', import.meta.url), 'utf8'));
for (const c of ranges) {
  test(`range: ${c.id}`, () => {
    assert.equal(typeof stats.rangeSummary, 'function');
    assert.equal(typeof reports.rangeReport, 'function');
    const original = JSON.stringify(c.values);
    assert.equal(JSON.stringify(stats.rangeSummary(c.values, c.lower, c.upper)), c.expected);
    assert.equal(reports.rangeReport(c.values, c.lower, c.upper), c.expected);
    assert.equal(JSON.stringify(c.values), original);
  });
}
