# H-Code: Mandatory symbol-first correction (2026-10-19)

STATUS: development candidate, not merged. H-Code is a new universal language
whose own source syntax is made of meaningful typed symbols, not a visual
TypeScript or SQL alias. Never substitute a glyph around ordinary programming
boilerplate for a real language improvement.

## GitHub audit

The main-branch recursive Git tree includes 102 H-Code .hc files spanning
examples, immutable historic benchmarks, package implementations and apps.
Preserve prior source content and signed SHA measurements. In particular,
keep the original 20-task registry SHA
46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3 unchanged.

1. M19.15 B1: three-operand ⧈ required long raw SQL. Keep it as a low-level
   parameterized escape hatch; add a native two-operand typed-table projection
   ⧈⦃record schema⦄(database,table) and test it in Rust, JS and real SQLite.
   No hardcoded business field names or precomputed app data in the compiler.
2. M19.15 B2a: ⟙ is a real glyph but table captions and cells are still hand-
   assembled. Before B2 is accepted, compress with generic typed record/list
   composition and safe text-only DOM operations. Do not fabricate a dashboard
   macro. The original dashboard acceptance requires grouping, UI and Chrome.
3. M19.13/14: form and todo programs work but still contain repetitive DOM,
   event and storage code. Preserve validation, persistence, accessible markup
   and security; measure improvements on identical accepted workloads.
   Todo's historical ~27.16% case reduction is not the global goal.
4. M19.12/06-11: keep full CRUD, I/O and concurrency correctness. Audit and
   replace verbose developer-side scaffolding with only general, inspectable
   typed symbols, after passing independent parity tests.
5. Tasks 16-20: do not mark unsupported work as done or change the denominator.
6. Documentation and CI: the preferred spelling always leads with symbols,
   secondary ASCII aliases are for accessibility, never the design centre.

## Executable paired candidate (not full task15)

H-Code: compact/canonical20/programs/15-db-symbol-first-b1.hc
TypeScript: compact/canonical20/idiomatic/15-db-table-symbol-first.ts

Both must execute on the same seeded disk-backed SQLite, and Rust-generated
H-Code ESM, independent H-Code JS interpreter and idiomatic TypeScript must
produce exactly matching ordered records. SQL is NOT written by the H-Code
developer for the typed table read. Negative permissions, schema and hostile
table identifier cases must fail closed; legacy SQL mode must still work.

Pre-CI source counts (including comments):
H-Code: 291 Unicode code points, 330 UTF-8 bytes;
Git blob 730daae69d80bbfb52200c056d368161600518ac.
TypeScript: 1,077 Unicode code points and 1,077 UTF-8 bytes;
Git blob f753b7ec77bf5aff06025a618ef4a5df6e8a3451.
The one provisional candidate saves 72.98% Unicode code points, 69.36%
UTF-8 bytes, CONDITIONAL on executable equivalence and exact-head CI.

This pair is NOT the original Canonical15 database-backed dashboard and NOT
evidence for a global 70% improvement across the twenty fixed workloads.
Generated ESM, runtime and SQLite dependency sizes must be reported separately.

## Future verification and acceptance

Every new native symbol must have genuine lexical, AST, type-check and runtime
semantics, paired ASCII compatibility, Rust and independent JS implementation.
Freeze source SHA, run independent idiomatic TS parity, include failure cases,
and report all Unicode/UTF-8 gains AND regressions on original workload IDs.
A new full database dashboard may count only after source-authored grouping,
real browser UI, security, Windows/Ubuntu CI and a fair full-app comparator.
Do not merge unverified stacked draft branches or quietly overwrite old
benchmarks to manufacture a better score.
