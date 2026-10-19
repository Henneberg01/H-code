# M19.15 - genuine SQLite-backed dashboard, Canonical20 task 15

Status: **B0 reference contract only**. H-Code does NOT implement database access yet.
No compiler verification, partial credit, 15/20 score, competitive source-size
measurement, or main merge is claimed by the contract.

## Immutable preregistration

- Registry: `compact/canonical20/workloads.json` Git blob SHA
  `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` (leave untouched).
- Original ID: `15-db-dashboard` (15th of the original 20).
- Original acceptance: `query seeded data, aggregate metrics and render result views`.
- Capabilities: `database`, `records`, `ui`.
- This is a real database-backed dashboard, not data held solely in JS objects,
  localStorage, a JSON file, or a simulated query result.

## B0 independent frozen correctness contract

Source locks (Git blob SHA-1, byte-for-byte UTF-8 and LF on every platform):

| File | Git blob SHA |
| --- | --- |
| `compact/canonical20/cases/15-db-dashboard.json` | `184266b6e49cb8e328e868e6ebc3f1a9bec78b58` |
| `scripts/canonical20-db-oracle.ts` | `82654f315c7d967228f5a0670b28265a185822b6` |

`node --experimental-sqlite --experimental-strip-types --test
scripts/canonical20-db-contract.test.mjs` requires Node 22 with built-in SQLite
module. SQLite and type stripping are still experimental in Node 22. No
third-party TypeScript dependency or H-Code implementation is imported.

The independent reference seeds **14 real SQLite rows** with `orders` columns:
primary key ID, region (Unicode text), amount in nonnegative integer minor units,
payment status, ISO date. The database is a real file with SQLite headers. It
is re-opened for queries after the seed connection closes. Query inputs use
strict validated half-open date ranges; status is parameter-bound to `paid`.
Refunded/pending rows are excluded, never silently treated as paid.

Five source-locked cases:

1. January: 5 paid orders; 5,850 minor units, grouped and sorted by region.
2. February: 6 paid orders; 4,980 minor units, with Unicode and hostile HTML as
   literal region names.
3. March: 1 paid order; 333 minor units.
4. April: no paid orders; empty table and accessible empty state.
5. Quarter: 12 paid orders; 11,163 minor units; all five region groups.

The oracle produces a semantic HTML table with column/row header scopes, a
caption, a live status summary and an empty state. Dynamic values must be
HTML-escaped as **text**, never executable markup. Source independent tests
check exact rows and totals, four seed permutations, disk mutation after
re-opening, malformed date and SQL-like input rejection, invalid seed rows,
primary-key rollback and zero `<img>`/`<script>` markup from hostile strings.

These five cases and their expectations are the lower bound; implementation
must add adversarial/generated cases without altering original fixtures.

## Language architecture for B1-B3 (NOT IMPLEMENTED)

- **B1 generic database capability:** design a user-facing *typed glyph* for
  parameterized, explicitly permission-granted SQLite read queries returning
  bounded generic typed records. Provide an ASCII accessibility alias with
  exactly the same AST and semantics. Reject missing/ambiguous bindings,
  unexpected column types, unsafe DB paths, privilege escalation, excessive
  rows, unsupported statements, invalid UTF-8 and effect use in pure packages.
  No built-in `dashboard`, `orders`, `sales` or business-specific macro.
- **B2 authored H-Code application:** the query selection, group aggregation,
  date handling, and visible dashboard markup must genuinely be expressed in
  developer-authored `.hc` source using general language features. Compiled
  Rust ESM and the independent JS H-Code interpreter must agree with the
  oracle on the SAME disk-backed SQLite fixture and all negative tests.
  Browser UI must be inspected in actual Chromium, not asserted from strings.
- **B3 proof:** freeze H-Code, TS competitor and browser probe source hashes.
  Exercise repeated real Chromium runs, independent processes/restarts,
  Windows and Ubuntu, permissions, invalid DB and records, deterministic
  sorting, Unicode and inert hostile labels; verify exact-head CI and CodeQL.
  Only then may `scripts/canonical20-coverage.mjs` derive 15/20.

## Proof and compression discipline

The B0 TypeScript oracle is an independent **correctness reference**, NOT an
automatically fair competitive baseline. Before the 15th score, implement a
separately authored idiomatic TypeScript dashboard using maintainable standard
libraries and independently verify equivalence. Count all developer-authored
H-Code and TypeScript source, Unicode codepoints and UTF-8 bytes separately.
Also report SQLite/runtime dependencies, generated ESM size, build time and
runtime footprint. Keep the six remaining unsupported workload IDs in the
20-task denominator until independently verified; do not claim global >=70%.

Do not mix this scoped SQLite database adapter with the much broader planned
M44 PostgreSQL/migration milestone or claim to implement it by proxy.
