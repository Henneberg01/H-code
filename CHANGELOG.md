# JFH-CODE change log

## Unreleased — WebSocket room chat (2026-10-20)

- Added typed generic `⇄` / `websocket_serve` event reducers with a maintained, SRI-pinned ws 8.22.0 transport, explicit loopback grants, text/peer/queue limits and full output validation before state or sends.
- Closed callback purity gaps through nested registrations, named map/filter and composition helpers; rejected sparse outboxes atomically. Preserved typed empty JSON sequence constraints and ordinary-function argument context in the independent interpreter, with regression tests.
- Froze task17 protocol/traces before app implementation. Native/reference/TypeScript chat passes 42 wire runs, 2,526 accepted messages, 2,388 concurrent sends, 30 disconnects including 3 killed isolated client processes, and 9 rejected room/sequence/cleanup faults.
- Counted complete apps: 1,689 JFH-CODE vs 3,968 TypeScript codepoints (57.43% fewer), with UTF-8, common fixture, maintained dependency and generated runtime reported separately. Conditional acceptance coverage is 20/20; successful real-browser verification and the global 70% benchmark remain outstanding.

## Unreleased — signed stateful sessions (2026-10-20)

- Added typed HMAC-SHA-256 signing/verification (`✍`/`✓`, with readable aliases), canonical constant-time tag verification, exact UTF-8 bounds and transitive effect checking in Rust and the independent JavaScript language reference.
- Added optional raw HTTP header records preserving duplicate occurrences, a 128-pair budget and header-bound idempotency digests for the new request envelope. Session policy explicitly rejects request IDs to prevent stale authentication receipts.
- Fixed file-reader and CAS runtime import binding collisions when both are emitted into one program, with a syntax regression test.
- Froze task16's concrete protocol before implementing whole native and independent TypeScript/SQLite session apps. Verified 888 HTTP assertions, 45 forced crashes, 42 concurrent rotations, key replacement, Unicode-key boundaries, generation exhaustion and nine rejected application faults.
- Counted complete app source: 2,403 JFH-CODE vs 7,762 TypeScript codepoints (69.04% fewer); bytes, fixtures and generated runtime remain separate. Task17 and successful aggregate browser verification remain outstanding; the global 70% goal is unverified.

## Unreleased — incremental application feature (2026-10-20)

- Froze a concrete task20 starter and new acceptance before adding inclusive interval summaries, reports and a separate CLI. Preserved the original modules, tests and CLI protocol.
- Verified native and TypeScript old/new behavior, thirty-two generated datasets, 250 actual CLI runs and eight assertion-rejected old/new defects. Both CLI implementations reject malformed, missing, nonfinite and extra fields.
- Counted the whole extended project: 2,169 JFH-CODE vs 4,380 TypeScript codepoints (50.48% fewer), with UTF-8, common fixtures and generated runtime reported separately. Added derived task20 verification; the original registry and prior source locks remain unchanged. The global 70% target remains unverified.

## Unreleased — seeded bug-repair workload (2026-10-20)

- Fixed local import resolution for bare relative test filenames: `hcodec test entry.test.hc` now resolves the working directory like `hcodec test ./entry.test.hc`, with a regression test for both spellings.
- Committed a deliberate sixteen-value traversal bug and regression fixtures before applying a minimal repair. Original tests remain green on the seed, new cases reproduce assertion failures, and reinserting the bug reproduces failures again.
- Added native/TypeScript proof execution, thirty-two generated boundary cases, complete repaired-project source accounting and derived task19 readiness without changing the original twenty-workload registry.
- Reused common project-execution utilities while preserving task18's source locks and measurements. The repaired task19 project uses 39.87% fewer codepoints than its TypeScript counterpart; the global 70% target remains unverified.

## Unreleased — frozen refactor workload (2026-10-19)

- Established and committed a concrete baseline for Canonical18 before extracting a reusable statistics module; kept both native and TypeScript assertion files byte-identical.
- Added source-locked proof execution for both versions and languages, twelve fixed inputs, thirty-two generated inputs and six seeded faults. Authored-source measurement includes all modules, support/types and tests.
- Added derived task18 readiness without changing the original twenty-workload registry. The measured 36.51% source reduction on this task does not establish the global 70% goal.

## Unreleased — native program testing (2026-10-19)

- Added the typed assertion sign `⊨` with accessible `assert` alias in the Rust compiler and JavaScript reference.
- Added `hcodec test` with real module/package resolution, sorted `.test.hc` discovery, TAP reporting, per-file timeouts and bounded output. Empty runs and assertion-free files fail.
- Added a numeric module/test example with an independently executable TypeScript comparison; this is groundwork for frozen workloads 18–20, not completion of the twenty-task 70% target.

## Unreleased — identity and paid licensing (2026-10-19)

- Adopted JFH-CODE as the official product name while preserving technical compatibility identifiers and immutable benchmark sources.
- Adopted proprietary commercial licensing requiring a separate paid agreement, with no free use grant. Third-party terms and previously granted legal permissions remain effective.
- Aligned package metadata, contributor-rights requirements and release checks with the current policy.

## M1 offline user-symbol reference (2026-10-17)

- Introduced an explicit version-pinned package import syntax and namespace qualification.
- Added a manifest-validated, SHA-256-locked local package loader.
- Linked bare user glyphs and readable qualified calls to the same canonical operation IDs.
- Added arity, direct-literal argument and runtime argument/return contract checks for exported pure operations.
- Isolated library execution from top-level interpreter builtins and applied a shared execution-step limit.
- Added a demonstration package, example, authoring guide and regression/security-negative tests.
- Kept the reference implementation dependency-free. No compiler or performance claims.

## Initial M1 reference (2026-10-17)

- Initial lexer, parser, reference interpreter, core symbols, examples and CLI.
- Original 17-test baseline and project foundation.

## 0.2.0 - Milestone M2 (Rust frontend)

- Added `compiler/` Rust crate and `hcodec check|ast` frontend CLI.
- Added canonical symbolic/ASCII Unicode lexer, parser, source spans, and structural AST.
- Added scoped static type inference, typed AST, type/arity/return validation and human-readable diagnostics.
- Added verified package interface loading using M1 SHA-256 lockfile and pure library source validation.
- Added Rust conformance suite and CI Rust job alongside the unchanged Node.js M1 suite.
- Execution remains in M1 JavaScript reference interpreter; Rust JavaScript emitter is M3.
