# Task 20: extend a frozen reporting application

```sh
npm run benchmark20:test20
npm run benchmark20:verify20
```

Requires stable Rust and Node 22+. The original twenty-task registry remains at
Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`. Its unchanged acceptance is
**extend frozen starter app while retaining all prior behavior and passing new
acceptance**.

## Provenance and behavior

The registry originally fixed a brief, not a concrete starter or feature. This
fixture is explicitly established on **2026-10-20**, deriving the reporting
modules and their assertions from task18 at commit
`c24ba245f85c266ec7337ced08706c6cf3b8731a`. A small CLI established in the starter
reads a JSON number array and prints the ordinary and positive reports on two
lines. Its outputs were executed and recorded before extending the app.

Starter modules, old tests, original twelve cases, CLI outcome snapshot, new
acceptance tests and ten interval cases were committed in
**c76bdf492ddb52a315b00fdc0df54946fc29e1e8** before the extension was written.
The snapshot includes both a valid empty array and invalid empty text; these
share an ID and are distinguished by frozen source order, not an ambiguous ID
lookup. Source locks anchor both manifests, copied origins, all old/new source,
inputs, outcomes and the contract. Additional uncounted files are rejected.

The feature adds `rangeSummary(values, lower, upper)` and `rangeReport`, using
ordinary typed filtering and composition. Both bounds are inclusive. Equal
bounds include matching values; reversed bounds and disjoint intervals return
the existing all-zero empty summary. Arrays are not mutated. A separate range
CLI accepts `{values,lower,upper}` and prints one report. The old entry point and
its protocol remain byte-identical. No new compiler primitive or adapter hides
the application logic.

## Executed evidence

- Old tests pass on starter and extension in both languages: four runs, each
  with 72 native assertions or 24 TypeScript tests.
- The new TypeScript acceptance runs on the starter and fails ten actual
  assertions because the exports are absent. The native starter also lacks
  these operations; its compiler error is explicitly **not** counted as an
  assertion failure.
- The extension passes old/new tests: three native files with **102 assertions**
  and **34 TypeScript tests**, covering twelve old and ten new cases.
- Thirty-two extra generated interval datasets run alongside the unchanged old
  cases: **168 native assertions** and **56 TypeScript tests**.
- **250 actual CLI processes** verify old frozen outcomes on both versions,
  new fixed/generated interval reports, generated old-protocol reports, and
  rejection of invalid input. Invalid cases include wrong/missing fields,
  malformed JSON, nonfinite input, invalid UTF-8 and additional unknown fields.
  Both languages reject invalid input with nonzero status, empty stdout and a
  diagnostic; matching diagnostic text across languages is not claimed.
- Eight counterfactual faults change inclusive lower/upper bounds or regress
  old positive/total behavior. All fail by real assertions; the four boundary
  faults preserve old tests, demonstrating the new acceptance is necessary.
- Integrity tests reject edits to starter/origin source, old/new assertions,
  expected data/outcomes, the extension and manifests, plus hidden extra files.

The proof executes the current Rust compiler and native test runner, plus
independent idiomatic TypeScript. Expected outputs use a separate neutral
calculation. The JS reference has no local module loader and is not counted as
a third engine. Node strips TypeScript types; a separate `tsc` check is not
claimed. The former task18 and task19 source fixtures remain unchanged.

Final focused validation passed **19 task18/task19/task20 proof tests** and
the existing **175 JavaScript reference tests**, with no failures or skips.
The symbol-first audit and release checks also pass. No compiler or reference
implementation changes were needed for this feature.

The aggregate command was also executed with the installed browser selected:
`HCODE_CHROME=/usr/bin/chromium npm run benchmark20:test`. It finished with
**4 passed and 2 failed**. The coverage proof fails at task13's real Chromium
comparison after a 30-second browser timeout. The strict-gate test consequently
gets process status 1 instead of its expected incomplete-report status 2. This
stops aggregate verification before task20; its standalone proof above passes.
No browser requirement, assertion or gate was disabled to obtain a green run.

## Whole-project measurement

All extended source counts: old/new modules and tests, types, fixture readers,
input validation and both CLI entries, including whitespace. This measures the
whole extended app, not just the feature diff or time spent implementing it.
It is a distinct workload and cannot replace earlier task18/task19 measurements.

| Scope | JFH-CODE | TypeScript | Reduction |
|---|---:|---:|---:|
| Authored Unicode codepoints | 2,169 | 4,380 | **50.48%** |
| Authored UTF-8 bytes | 2,572 | 4,380 | **41.28%** |
| Codepoints including common JSON/outcome fixtures | 16,736 | 18,947 | 11.67% |
| UTF-8 bytes including common JSON/outcome fixtures | 17,139 | 18,947 | 9.54% |

Five shared input/outcome fixtures total **14,567 codepoints/bytes**, reported
both separately and inclusively. There are no external package dependencies.
Generated native CLI programs total **28,605 bytes**, and generated tests total
**47,665 bytes in this Linux run**, including duplicated runtime. Per-artifact
sizes and SHA-256 digests are recorded; resolved paths affect generated results.
Runtime performance, universal floating-point behavior, toolchain footprint,
development speed and AI tokens are not measured.

This proves only task20 and does not establish the global 70% goal. The current
task13 Chromium check still times out in this cloud environment. Aggregate
**18/20** coverage is conditional on every current proof actually passing and
is not asserted from this standalone result. Signed sessions (16) and WebSocket
chat (17) still lack full proofs. Earlier source locks, the original registry
and its twenty-workload denominator remain unchanged.
