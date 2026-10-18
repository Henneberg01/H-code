# H-Code empirical benchmark policy

**No speedup has been measured yet.** Symbols can reduce characters while increasing token count, cognitive load, or development effort. Benchmark complete working tasks, not just syntactic brevity.

## Categories

1. Syntax size: source bytes, nonblank source lines, package/dependency size, generated code footprint.
2. Developer speed: time to successful verified output including debugging and review.
3. AI efficiency: end-to-end model input/output tokens, retries, wall-clock duration, cost and human interventions.
4. Correctness: tests passed, functional equivalence, static defects, regression rate.
5. Runtime: CPU/wall time, allocations, peak memory, startup, output bundle and build time.
6. Portability and developer experience: install success, accessibility, reviewer comprehension and debugging tasks.

## Fair comparisons

- Competitor projects can use industry-standard libraries, templates, frameworks and automation, not boilerplate-only baselines.
- Execute each benchmark repeatedly; record environment, CPU, tool versions and variance.
- Keep training/prompt budgets comparable when testing AI.
- Separate handwritten H-Code from generated JavaScript; measure both.
- Report wins, regressions and unsupported cases. Do not claim global superiority based on one task family.

## First 20 benchmark workloads (planned)

1. Basic calculator CLI
2. Fibonacci recursion
3. Text frequency counter
4. CSV reader with validation
5. JSON transformation
6. HTTP client with retries
7. Local file conversion
8. Async concurrent request aggregation
9. Cache with expiration
10. Generic collection transforms
11. Markdown document processing
12. Basic CRUD API
13. Form validation UI
14. Interactive todo app
15. Database-backed dashboard
16. Authentication session handling
17. Simple WebSocket chat
18. Unit-test refactor task
19. Bug reproduction and repair task
20. Incremental feature on existing app

Only the first two are within the M1 reference interpreter's basic capability; it also runs small pure functions through offline symbol libraries. The others are future goals; they must not be marked passed.

## Phase 1 symbol-first measurements — 2026-10-17

Command: `npm run phase1:test`; `npm run phase1:measure -- --output phase1/results/source-metrics.json`. Dataset: four executable pairs under `phase1/fixtures/`, not an artificial competitors' JavaScript or TypeScript baseline. Node v24.17.0 on Windows x64. The harness verifies equivalent linked JavaScript ASTs and outputs; the separate Rust integration test checks compiled JavaScript output equivalence. `phase1/results/source-metrics.json` is machine-readable source data.

| Equivalent task | Glyph Unicode code points | Alias code points | Code point reduction | Glyph UTF-8 bytes | Alias UTF-8 bytes | Byte reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Typed function | 70 | 79 | 11.39% | 79 | 79 | 0% |
| Boolean expression | 60 | 74 | 18.92% | 71 | 74 | 4.05% |
| Recursive function | 87 | 100 | 13.00% | 96 | 100 | 4.00% |
| Locked library sign | 58 | 68 | 14.71% | 64 | 68 | 5.88% |

**Interpretation:** H-Code signs save source **code points**, but Unicode frequently uses multiple UTF-8 bytes. In isolation `≡` takes three bytes while `==` takes two. Measurements do **not** demonstrate the 70% smaller-source aspiration across real applications; symbol-powered typed reusable operations require much larger workbench comparisons.

**AI tokens**: not measured (no specified/pinned tokenizer). **Developer speed**: not measured. **Generated JS byte size** and **execution runtime comparison**: not measured. Do not conflate them with source compression.

Independent existing CLI startup/parse+typecheck benchmark: `npm run bench` (run five samples per case) reported the following **median process wall-times**, with Windows x64 and Node v24.17.0: Fibonacci 9.49 ms, invoice 9.88 ms, inventory 10.32 ms, savings 9.78 ms. These numbers have **no comparative baseline** and cannot demonstrate H-Code executes faster than Rust, JavaScript or other languages. Reproduce with `cargo build --manifest-path compiler/Cargo.toml` then `npm run bench`.

## CSE-1 source metrics (feature branch, pending execution)

Run `npm run compact:measure` for seven Unicode/ASCII **H-Code-only** fixture pairs and `npm run compact:test` for the measurement code. This reports separate code-point and UTF-8 byte reductions. It does **not** compare against TypeScript or establish the project's 70% goal. See `docs/CSE1_STATUS.md` for conformance and review gates.

## Eight preliminary H-Code vs TypeScript executable baselines (M10)

`compact/benchmarks/paired` contains eight varied idiomatic TypeScript implementations and equivalent H-Code sources. Run `npm run compact:ts-parity` with Node 22+ and cargo; the script checks exact stdout parity and fails rather than counting incompatible implementations. **No verified result is asserted yet**, and none of these cases constitutes the completed 20-task study.

**Anti-cherry-picking rule:** Preserve tasks where H-Code expands source size. Treat a negative reduction as a regression, not an outlier to hide. Calculate median reductions on **all** eight predeclared pairs, report bytes separately, and prioritize general-purpose syntax improvements based on the failures.


## Correction: different benchmark corpora are NOT a before/after regression

The formerly reported **26.73%/30.71%** reference-program reductions, initial M10 two-case **31.25%/47.86%**, and expanded M10 eight-case median **2.27%** came from **different program selections, baselines or execution levels**. They must not be described as repeated measurements of identical tests. Source pairs were not frozen for the two oldest results and cannot be reconciled as an exact before/after measurement. **Both original M10 task results are preserved unchanged** in the eight-case corpus. See `docs/BENCHMARK-PROVENANCE.md` for frozen Git blob SHAs and the test `scripts/test/compact-frozen-benchmark.test.mjs`. The universal 20-case, Rust-verified result is still pending.

## M15 signed source-level comparison with the SAME eight M10 tasks

The new M15 variants live in `compact/benchmarks/m15/` and preserve the complete original eight-task M10/TypeScript dataset. All 24 source Git blobs are pinned and `npm run m15:measure` compiles old and new H-Code with actual Rust and executes the unchanged Node22 TypeScript programs. Code point and UTF-8 distributions are separate. Do not mix this eight-task population with the distinct three-task M14 corpus or the unfinished canonical twenty-task study. See `docs/M15-SIGN-BLOCKS.md`.

## M19: fixed twenty-workload preregistration

The twenty workloads listed above are registered in `compact/canonical20/workloads.json` without exclusions, renames, or substitutions. Run `npm run benchmark20:status` for compiler-validated task-05 proof and source-frozen M10 and M14 partial evidence. **On `main` after reviewed/merged PRs #30 and #31, 5/20 are functionally/compiler verified, 0 have partial-only evidence, and 15 remain unsupported**. Task 02 requires a separate source-locked proof in addition to Task 05. The SHA-frozen 20-workload registry itself is unchanged. The original three-example M14 median **68.46%** is retained as historical M14 evidence, never presented as the global twenty-workload score. The strict gate `npm run benchmark20:strict` intentionally fails until the full twenty are compiler-validated. Package authoring source is part of the authored code metric. See `compact/canonical20/README.md` and `docs/M16-3-GLYPH-PACKAGES.md`.

## First full preregistered task proof — 2026-10-18 (draft PR #25)

Workload `05-json-transformation` (`deserialize structured input, transform nested typed fields, serialize valid JSON`) is now checked by `npm run benchmark20:verify05`. The source/fixture SHA-frozen proof executes real Rust-generated JS, the independent H-Code reference and the idiomatic TypeScript runtime guard on 3 fixed positive, 12 generalized positive and 11 invalid cases. The baseline implements proper runtime schema checks rather than just `JSON.parse() as Type`. Output parity and fail-closed malformed input are mandatory. **594 vs 2005 developer-authored Unicode codepoints = 70.37% fewer on *this one canonical workload***; UTF-8 is **651 vs 2007 bytes = 67.56% fewer**; **6560 generated JS bytes** are recorded separately. The 70% goal is NOT met for the overall 20; global median stays null until all pass. The former stacked PR #25 was integrated into `main` via consolidated PR #30. See `compact/canonical20/PROOF-05.md`.

## Second original task proof — Fibonacci recursion (draft PR #26)

Original task **02-fibonacci-recursion** is now checked by `npm run benchmark20:verify02` against its **unchanged M10 SHA-frozen** H-Code and TypeScript sources. The original acceptance remains *n=7, stdout 13, real recursion, typed parity*. The verifier uses both real Rust compiler→Node JS and H-Code JS reference against the original TS program, plus 16 variable n cases and 3 static Rust-type-negative cases. No registry IDs or acceptance criteria change.

This original file is **96 H-Code Unicode codepoints vs 94 TS, a 2.13% regression** (H-Code UTF-8 105 bytes versus TS 94 bytes). It is counted as such. The separate SHA-locked `02-fibonacci-glyph-first.hc` candidate uses native compact constructs `↩ ≤ ?` and has **64 Unicode codepoints (31.91% fewer than the same TS baseline)**, but is measured **separately** and never silently swapped with the historical input. Candidate runtime parity is a required CI gate. See `compact/canonical20/PROOF-02.md`.

The target remains ≥70% median with all 20 fully compiler-verified, with Unicode points, UTF-8 bytes, runtime size and deps reported individually. **No global 70% conclusion** is possible with only five verified tasks. Existing M14 median 68.46% over its original three other tasks is unchanged.

## Third fixed task with compiler proof — generic collection transforms (draft PR #27)

The original task `10-generic-collection-transforms` acceptance, registry SHA and all three M14 original sum/map/filter code/TS SHA fixtures are **unchanged**. A new full typed H-Code program exercises Number, String, Bool, structured records, nested arrays, typed empty sequence and actual typechecked `∑` / `⇢` / `⌕` constructs. The program's deterministic output matches Rust H-Code compilation, JS H-Code reference and Node TypeScript. A reproducible 19-set generated suite adds 47 outputs, and six ill-typed programs must be rejected statically by Rust.

On this **one canonical workload**, developer source is **505 H-Code vs 836 TypeScript Unicode codepoints = 39.59% reduction**, and **645 vs 836 UTF-8 bytes = 22.85% reduction**. Generated JS is **7,305 bytes**, reported separately. Historical M14 median **68.46%** over its unchanged three tasks remains independently true, but is not the score for the expanded complete workload. The global 20-task median remains null (15 tasks unsupported on stacked CSV PR #29). See `compact/canonical20/PROOF-10.md`; run `npm run benchmark20:verify10` and `npm run benchmark20:status`.

## Fourth fixed task with full compiler proof — Unicode token frequency (draft PR #28)

The exact original canonical task `03-text-frequency-counter` acceptance is **“normalize and count tokens; deterministic frequency ordering including Unicode cases”**. It is not substituted with an easier emoji-only count. The three independent core-language glyphs are `⫶` (Unicode scalar sequence), `⟟` (NFC + lowercase + NFC Unicode word tokenizer), and `⧉` (typed, Unicode-codepoint-sorted histogram across String/Number/Bool). Their Rust and JS implementations have shared statically specified semantics, are bounded, and cannot be shadowed by package glyphs.

A source-SHA-frozen complete `.hc` source with **10 fixed cases**, plus **28 generated unseen Unicode cases**, **six negative Rust static typechecks**, **five general primitive executions** and an excessive-token runtime rejection is compared against the independent H-Code JS interpreter and an idiomatic TypeScript baseline with real normalization, Unicode tokenization and histogram sorting.

**One complete canonical task 03:** **437** developer-written H-Code Unicode codepoints vs **1,541** TypeScript (**71.64% reduction**); **499 vs 1,592 UTF-8 bytes (**68.66% reduction**)**; **8,970 bytes compiled JavaScript** (separate, not source authoring). Package dependencies not measured, compiler wall-clock time not benchmarked, and Node TS `--experimental-strip-types` execution is not a full standalone `tsc` typecheck. Historical M14 median **68.46%** for three narrow previous tasks is unchanged.

Full SHA manifest and restrictions: `compact/canonical20/PROOF-03.md`. `npm run benchmark20:verify03` performs the actual complete proof; `npm run benchmark20:status` now derives **5/20 full, 0 partial, 15 unsupported** across the later integration, only if all full proofs succeed. The original Git-blob-frozen 20 task register remains untouched. No global 70% median exists yet.

## M19.04 — fifth canonical workload: typed CSV and opt-in file I/O

The original SHA-locked workload `04-csv-validation` retains its unchanged quoted CSV, malformed rows, and typed-column acceptance. Native `⧄` file access is opt-in and denied within pure packages; native `⧇` decodes CSV to statically typed records. Proof requires four valid, six malformed, forty generated datasets and five invalid H-Code typecheck sources executed across Rust-generated Node JS, independent H-Code JS, and a standalone TypeScript oracle. The original registry remains SHA-frozen. See `compact/canonical20/PROOF-04.md` and run `npm run benchmark20:verify04`.

**Benchmark fairness:** A stand-alone 3,936-character TypeScript parser is a correctness oracle, not necessarily idiomatic TS source with a maintained CSV dependency. A separate, genuine dependency-pinned TypeScript library comparator has now been added in PR #32; it replaces the *source-compression baseline*, not this independent handwritten correctness oracle. Do not infer 70% global success from one task. The historical M14 68.46% three-case median remains intact. Overall 20-case median is undefined while 15 are unsupported.

## Library-backed fairer task 04 source comparison (draft PR #32)

The new comparator imports **csv-parse v7.0.2** (real quoted CSV parsing) and **Zod v4.6.5** (runtime schema validation) rather than comparing H-Code to a handwritten TypeScript parser. Two standalone TS authoring files include all necessary imports, strict field conversion, source/filename safety checks and four original CLI calls; neither generated test scaffolding nor dependency source is hidden in authored source. Exact library package versions and SHA-512 SRI are locked in an isolated package-lock file, and both NPM trees are installed and weighed separately.

| Source and dependency metric | Original H-Code | Idiomatic library-backed TypeScript |
|---|---:|---:|
| Authored Unicode codepoints | **258** | **3,362** |
| Authored UTF-8 bytes | **273** | **3,362** |
| Authored source reduction | **92.33% fewer codepoints** | baseline |
| Authored source reduction in bytes | **91.88% fewer UTF-8 bytes** | baseline |
| Installed csv-parse 7.0.2 (Linux snapshot) | bundled as language runtime, separate | 1,606,924 bytes |
| Installed Zod 4.6.5 (Linux snapshot) | bundled language typechecker, separate | 6,140,311 bytes |

Run `npm ci --prefix compact/canonical20/baselines/04-idiomatic-typescript --ignore-scripts` and `npm run benchmark20:csv-idiomatic` on Node 22. Both Windows/Linux CI configurations require four frozen valid files, six invalid files, 40 deterministic additional datasets, unsafe path/permission checks, package-integrity and authored-source SHA locks. The original `.hc` and `.ts` correctness-oracle source files and frozen 20-task registry are **unmodified**.

These numbers describe **task 04 only**, not the 20-task median. Installer tree bytes include distributed type declarations and files; compressed library tarball bytes, TypeScript strict `tsc` verification, compiler timing, native toolchain footprint and comparative runtime performance are not measured. One high per-task ratio cannot compensate for 15 unsupported tasks.
