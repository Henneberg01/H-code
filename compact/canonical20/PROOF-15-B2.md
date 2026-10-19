# Canonical15 B2 — actual developer-written H-Code dashboard (candidate)

Status: **not accepted, not merged, not 15/20 verified.** B1 typed generic
⧈ SQLite operation must be accepted first. This is genuine H-Code application
source on a separate stacked development branch, never a dashboard macro.

H-Code source: compact/canonical20/programs/15-db-dashboard-b2.hc

- Reads a typed from/to date record from real stdin through H-Code ⌨ and ⤓.
- Makes a real parameterized SQLite grouped SELECT using the general B1 ⧈.
- Aggregates totals from typed DB result records using H-Code control flow.
- Generates a complete, semantic HTML document using H-Code String operations.
- Escapes all untrusted region names through an H-Code-authored function;
  hostile HTML tag text must remain visible inert text, never markup.
- Emits an accessible table and live status; empty data has an explicit state.

The unchanged B0 independently authored TypeScript correctness oracle remains
the judge. Tests run *all five original date periods* on one real SQLite file
and compare byte-exact HTML across: Rust-generated H-Code ESM, independently
executed JS H-Code interpreter, and independent TypeScript oracle, including
Unicode/hostile input and empty state. Both H-Code engines must reject missing
database permission; the host must never synthesize fixture results. Existing
B1 tests cover symlinks, wrong types, SQL injections and permission boundaries.

Command:
    node --experimental-sqlite --experimental-strip-types --test scripts/m19-db-dashboard-b2.test.mjs

Not yet covered: strict ISO calendar validation inside user-authored H-Code
matching all negative inputs of the TS oracle, browser DOM verification in
real Chromium, independent process restarts, derived exact-source locks,
competitively authored TypeScript source-size comparison and repeated metrics.
No Canonical15 coverage/70%-global claims until all of those are verified.
