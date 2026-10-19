# Task 18: refactor a frozen project with unchanged assertions

Run from the repository root with stable Rust and Node 22+:

```sh
npm run benchmark20:test18
npm run benchmark20:verify18
```

The original task and twenty-workload registry remain unchanged at Git blob
`46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`. Task 18 requires refactoring a frozen
baseline without modifying its required behavior or assertions. The registry
contained a brief but no concrete starter source. The numerical-summary project
was therefore established on **2026-10-19**, and its baseline, twelve cases and
tests were committed as **43d49ba2529befc10210062eaa4128ff9260a2b0** before the
refactored variant was written. This is an explicitly new fixture, not a claim
of a historical baseline that did not exist.

## Behavior and actual refactoring

The project exposes `summarize`, `positiveSummary`, `report` and `positiveReport`.
It computes count, minimum, maximum, total and mean for a numeric sequence or
its strictly positive elements. Empty sequences return zeros. The report module
imports the statistics module and emits the same deterministic JSON fields.
Tests check all fields and ensure callers' input arrays remain unchanged.

The baseline duplicates the accumulation logic for all values and positive
values. The refactored project extracts a reusable core module and composes it
with filtering. The native source uses existing typed sequences, records,
`∑`, `⌕`, control signs and ordinary local imports. No compiler or runtime
implementation is added for this application. TypeScript uses standard array
operations and the same public API; all type and support files are counted.

Both native assertion files and both TypeScript assertion files are preserved
**byte for byte** across the variants. Both manifests, every source file, the
contract and the data fixture have Git-blob source locks. The baseline was
committed separately; editing a manifest cannot silently approve new baseline
bytes because the manifests themselves are anchored in the verifier. Unexpected
project files fail the inventory check.

## Executed evidence

- Both versions compile through the current Rust compiler and execute through
  `hcodec test`, including the report → statistics → extracted-core import chain.
- Twelve fixed datasets produce **72 executed native assertions per version**;
  the independently executed TypeScript version runs **24 tests per version**.
- Thirty-two additional deterministic datasets exercise the same unchanged test
  files: **192 native assertions** and **64 TypeScript tests per version**.
- Six deliberately broken implementations — incorrect totals, incorrect minima
  and treating zero as positive, in both languages — must fail by assertions.
- A separate TypeScript regression runs both versions and their unchanged test
  files with 200,000 values, preserving the baseline's large-array behavior.
  This is not claimed as native coverage: native sequences already have their
  own execution and allocation limits.
- Integrity tests reject changed baseline source, assertion/data drift, altered
  manifests and extra source files.

The independent H-Code JavaScript reference does not currently load local
multi-file projects. It is **not counted** as an execution engine here. The
proof compares the actual native compiler, independent TypeScript and a neutral
expected-output calculation. TypeScript runs with Node's type stripping; a
separate `tsc` typecheck is not claimed.

Local validation on 2026-10-19 passed all seven verifier tests and eighteen
assertion/test-runner regression tests. The aggregate `benchmark20:status`
command still stops at the existing task13 Chromium timeout in this cloud
environment, also reproducible with an empty browser page. This run therefore
does not assert an aggregate 16/20 pass; task18's standalone evidence is separate.

## Source measurement

All application modules, test files, type declarations and fixture-reader code
are included, with whitespace and imports. UTF-8 bytes are separate from
Unicode codepoints. Neither variant uses an external package dependency.

| Source scope | JFH-CODE | TypeScript | Reduction |
|---|---:|---:|---:|
| Baseline authored Unicode codepoints | 1,618 | 2,339 | 30.83% |
| Refactored authored Unicode codepoints | 1,313 | 2,068 | **36.51%** |
| Baseline authored UTF-8 bytes | 1,928 | 2,339 | 17.57% |
| Refactored authored UTF-8 bytes | 1,568 | 2,068 | **24.18%** |
| Refactored codepoints including common JSON fixture | 4,389 | 5,144 | 14.68% |
| Refactored UTF-8 bytes including common JSON fixture | 4,644 | 5,144 | 9.72% |

The native refactor itself removes **18.85%** of its baseline codepoints.
The shared JSON input/expectation fixture is 3,076 codepoints/bytes, separately
reported and included in the alternate totals above. It is never silently
counted for only one language.

Generated JavaScript for the two refactored native test files totals **28,291
bytes in this Linux run**, including runtime duplication between the files.
The verifier reports per-file bytes and SHA-256 separately from authored source.
Resolved module paths appear in generated identifiers, so generated artifact
size and digests depend on the execution environment. Toolchain footprint,
runtime performance, refactoring time and AI-token usage are not measured.

This proves one refactor workload, not the global twenty-workload target. Its
**36.51%** source reduction is below 70% and remains part of the evidence.
The aggregate checker includes task 18 only after rerunning this proof and all
other required proofs; it must not bypass existing browser, HTTP or database
tests to report a larger verified count. The global median remains null while
any of the twenty workloads is unverified.
