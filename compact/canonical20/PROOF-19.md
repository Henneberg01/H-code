# Task 19: reproduce a seeded failure and repair its root cause

```sh
npm run benchmark20:test19
npm run benchmark20:verify19
```

Requires stable Rust and Node 22+. The original twenty-workload registry remains
at Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`. Its task19 acceptance is
unchanged: reproduce seeded failure, fix actual root cause and verify regression.

## Provenance and diagnosis

This is a deliberately seeded benchmark fixture established on **2026-10-20**,
using task18's good project from commit
`be6badf576cec884d30895b88855a7ba73611b94`. The seed, old source/tests, new
regression assertions, expected data and contract were frozen in commit
**ced043c5668d3563c51cf25049e36bff2c33a0ef** before writing the repaired variant.
It is not a production incident or a measurement of bug-finding time.

The seed limits a shared core loop to the first sixteen values. H-Code's extrema
scan uses `i<count∧i<16`; TypeScript's accumulation loop iterates
`values.slice(0,16)`. Both can produce incorrect summaries when a tail contains
new extrema; the TypeScript truncated accumulation also changes totals.

All twelve original inputs contain at most five values. Their unchanged tests
must still pass on the seed: 72 native assertions and 24 TypeScript tests.
Five new cases put maxima, minima or fractional extrema after the processing
window, including the positive-filter and transitive-report paths. A sixth
case has exactly sixteen values and serves as a passing boundary control.

The repair removes only the artificial traversal limit in each core. All
application code then matches the prior good project byte for byte. Original
assertions and new regression assertions remain identical. Source locks anchor
both manifests, every application/test file, both JSON fixtures and provenance.
The inventory rejects additional uncounted files.

## Executed evidence

- The original tests pass on both seed and repair in both languages (four runs).
- Each of the five reproducing cases fails by an actual assertion in each
  language (ten reproductions); both sixteen-value controls pass. A compiler
  error, missing process or timeout is rejected as reproduction evidence.
- The repaired full project runs three native test files with **102 assertions**
  and **30 TypeScript tests**, covering twelve old and six new inputs.
- Thirty-two additional boundary inputs give **232 native assertions** and
  **56 TypeScript tests**, including the unchanged old cases in each run.
- Reinserting the seeded core into the repaired full project fails the new
  regression while the old tests still pass. Parsing this evidence accepts both
  Windows and POSIX path separators.
- Integrity tests reject changes to seed/origin source, assertions, expected
  data and repaired source/manifest. Task18's existing verifier tests also run
  after extracting common execution/accounting utilities.

The proof uses the actual current Rust compiler, native module resolver and
test runner, plus independently executed TypeScript and neutral expected-output
calculation. The H-Code JS reference has no local module loader and is not
counted. Node strips TypeScript types; a separate `tsc` check is not claimed.

Final validation also passed all **216 Rust tests** and **13 task18/task19
proof tests**, with no failures or skips. A separate product regression fixes
local imports for `hcodec test entry.test.hc`, matching the `./entry.test.hc`
spelling; its test failed before the resolver fix and passed afterward.

## Repaired-project source measurement

This counts the entire repaired project, including all old/new tests, modules,
types, fixture readers, whitespace and imports. It does not measure edit size or
repair speed. It is a different workload from task18, not a repeated score for
the refactor dataset.

| Scope | JFH-CODE | TypeScript | Reduction |
|---|---:|---:|---:|
| Authored Unicode codepoints | 1,728 | 2,874 | **39.87%** |
| Authored UTF-8 bytes | 2,071 | 2,874 | **27.94%** |
| Codepoints including both common JSON fixtures | 7,533 | 8,679 | 13.20% |
| UTF-8 bytes including both common JSON fixtures | 7,876 | 8,679 | 9.25% |

The common input/expectation files total 5,805 codepoints/bytes and are reported
separately as well as in the inclusive totals. No external package dependencies
are used. The three generated native test programs total **43,372 bytes in this
Linux run**, including duplicated runtime; the report records per-artifact bytes
and SHA-256. Generated size/digests depend on resolved paths. Runtime performance,
toolchain footprint and AI tokens are not measured.

This proves task19 separately and does not establish the global 70% goal.
The current task13 Chromium check still times out in this cloud environment.
An aggregate 17/20 result is conditional on every proof passing; it is not
asserted from this standalone repair proof. Earlier sources, locks and the
twenty-workload denominator remain unchanged.
