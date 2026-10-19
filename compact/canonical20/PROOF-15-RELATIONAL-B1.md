# M19.15 relational signs — ⧈ typed table projection (new development candidate)

**Purpose:** H-Code is a universal sign-first language, not a TypeScript/SQL
shorthand. A developer can now request an existing SQLite table as a **typed
H-Code record sequence** without writing any SQL statement:

```hcode
≔r←⧈⦃amount_cents:Number,day:String,region:String,status:String⦄("orders.sqlite","orders")
≔p←r⌕λx:x·status≡"paid"∧x·day≥"2026-01-01"∧x·day<"2026-02-01"
⎙(⤒(p⇢λx:⦃amount:x·amount_cents,region:x·region⦄))
```

This is a **general operation** over arbitrary user schemas and safely named
SQLite tables. The existing three-argument `⧈` prepared SELECT variant is kept
for compatibility. The database is physically real and existing, with explicit
host permission and read-only access; there is no app-specific `orders` macro.

The Rust lexer/parser/typechecker creates a native `DbTable` AST with typed
`⟦Record⟧` return value. The generated Node runtime derives a restricted
projection and deterministic ordering from the schema, quoting table/column
identifiers only after validation; it does not interpolate executable H-Code
into SQL. The JS reference interpreter independently lowers the same H-Code
AST to its injected database host. SQL results must exactly match the declared
record; the existing row, byte and host-permission limits still apply.
This is not yet an isolation boundary against expensive queries over an
untrusted very large SQLite database; SQL execution time needs separate limits.
String `<`/`≥` comparisons use Unicode scalar order, not JavaScript's
UTF-16 code-unit ordering. Numeric comparisons keep their existing compact
emission; the Unicode comparator is linked only when required by source.

## Frozen, paired B1 measurement

Source-locked files:

- H-Code: `compact/canonical20/programs/15-db-symbol-first-b1.hc`;
  Git blob `92909eb679fedc07a37501331d24a097a49242d2`;
  **287 Unicode codepoints / 328 UTF-8 bytes**.
- Independently authored idiomatic TypeScript:
  `compact/canonical20/idiomatic/15-db-table-symbol-first.ts`;
  Git blob `f753b7ec77bf5aff06025a618ef4a5df6e8a3451`;
  **1,077 codepoints / 1,077 UTF-8 bytes**.

Exactly this *one* table-scan/filter/map workload is **73.35% shorter in source
codepoints**, and **69.54% shorter in UTF-8 bytes**. The paired integration test
must execute both sources on the same seeded, real SQLite file and compare
outputs with the independent H-Code JS engine, including negative permission,
wrong schema and unsafe name tests. Generated ESM, dependencies and runtime
performance are separate metrics, not hidden in this source score.

**This is not proof for the full Canonical15 dashboard or the global median
70% target across twenty source-locked programs.** The original benchmark
registry, baseline TS files and accepted canonical H-Code sources are not
rewritten. The next work must integrate this generic relational primitive
into a complete H-Code dashboard and measure the full source set honestly.

**Status:** development candidate, not accepted until Windows + Ubuntu
Rust/JS/SQLite, original Chromium, CodeQL and full conformance are green
on the exact PR head SHA.
