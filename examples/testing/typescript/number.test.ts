import assert from 'node:assert/strict';
import test from 'node:test';
import {magnitude, total} from './number.ts';

test('numeric helpers', () => {
  assert.equal(magnitude(-7), 7);
  assert.equal(magnitude(0), 0);
  assert.equal(magnitude(7), 7);
  assert.equal(total([1, -2, 3]), 2);
});
