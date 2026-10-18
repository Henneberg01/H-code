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
