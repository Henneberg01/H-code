# M19.15 B1 — general typed SQLite read (candidate)

**Status: NOT ACCEPTED / NOT MERGED.** This is a genuine general-purpose H-Code
language operation candidate, not a database-backed dashboard and not 15/20
verified coverage. The original 20-task registry and the B0 SQLite/TypeScript
correctness contract remain unchanged.

## Typed symbol-first source

The native glyph ⧈ and its ASCII alias db_rows must tokenize to the same
language operation and compile to byte-identical ESM. Example H-Code:

    ≔ rows=⧈⦃region:String,paidOrders:Number,revenueCents:Number⦄("orders.sqlite","SELECT region,COUNT(*) AS paidOrders,SUM(amount_cents) AS revenueCents FROM orders WHERE status=? GROUP BY region",⟦"paid"⟧);
    print(⤒rows);

The type checker requires an exact structural record result schema of 1–64
primitive String/Number/Bool fields, three argument types (database filename
String, SQL String, bound parameters ⟦String⟧), and returns a genuinely typed
sequence of records. User-authored applications can then apply ordinary
H-Code list/record operators without a hardcoded dashboard operation. Bool
columns accept only SQLite integers 0/1. Unknown fields, NULLs, blobs,
wrong types, invalid strings and oversized results fail closed.

## Host capability

Node 22+ SQLite (experimental under Node 22) must be explicitly granted an
absolute HCODE_SQLITE_READ_ROOT. Only existing regular SQLite files with safe
basenames in that real, nonsymlink directory are allowed, opened read-only.
A single SELECT statement is prepared with 0–16 bounded String parameters
and no interpolation. SQL <=8 KiB, results <=1000 rows and <=1 MiB serialized.
Pure verified packages, CAS reducers and synchronous user functions cannot
invoke this effect. Generated programs without ⧈ must not import SQLite.

The independent H-Code JavaScript interpreter receives an explicit trusted
dbHost.query adapter instead of gaining ambient database access. The host
enforces the physical file permissions; the interpreter independently checks
SQL, argument constraints and the declared result record schema.

**Limitations:** This is not a production sandbox for untrusted SQL, and there
can be OS pathname TOCTOU races. A query on a permitted database could still
consume excessive CPU. These require further implementation and testing.

## Acceptance

1. Native Rust parser/typechecker and ASCII/glyph parity.
2. Independent interpreter and compiled Rust ESM query the same real,
   disk-backed SQLite file and produce equal results.
3. Negative schema, missing permission, invalid SQL, oversized, symlink and
   malformed records are blocked without fake fallback data.
4. Windows and Ubuntu tests and CodeQL pass on the exact PR head.

Tests:

    cargo test --manifest-path compiler/Cargo.toml --test m19_db_rows
    node --experimental-sqlite --experimental-strip-types --test scripts/m19-db-rows.test.mjs

Canonical15 remains unverified until authored H-Code query, grouping, visible
browser dashboard, independently authored idiomatic TypeScript comparator and
exact-head source-locked Chrome/Windows/Ubuntu/CodeQL proof all pass. The global
70% median remains uncomputed; B1 does not measure it.
