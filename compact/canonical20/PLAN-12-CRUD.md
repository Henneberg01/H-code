# M19.12 — canonical task 12: genuine CRUD HTTP server (contract B0)

Status: **contract / implementation not started**. This document does not promote canonical coverage or implement an HTTP server.

## Source-locked original workload

Keep `compact/canonical20/workloads.json` unchanged, including its original Git blob SHA and task ID `12-crud-api`.

- Title: Basic CRUD API.
- Original acceptance: **"server endpoints create/read/update/delete, request validation and deterministic persistence"**.
- Required capabilities: `http-server`, `records`, `storage`.

This is the 12th item in the fixed 20-item suite, not a new user-selected easy case.

## Non-negotiable architecture

Implement **generic reusable language facilities**, never a `crud` intrinsic or hardcoded route/product/todo application in the Rust compiler:

1. **Typed inbound HTTP request handling**. Bind a real loopback TCP/HTTP server to a host-granted address and ephemeral port; expose method, path, headers and bounded body to *user-authored H-Code* functions. Request handlers must be typechecked AST expressions/functions; `GET`/`POST`/`PUT`/`DELETE` decisions and application state transitions belong to authored code. No Rust codegen shortcut which emits a prerecorded CRUD handler.
2. **Typed outbound response**. H-Code sets status, bounded UTF-8 body and content type; the host HTTP adapter serializes/returns real responses. Invalid statuses, oversized content and headers must fail closed. Use standard status semantics (201 created, 200 read/update, 204 delete, 400 malformed request, 404 absent item, 405 unsupported verb, 409 duplicate or conflicting change when applicable).
3. **Deterministic persisted storage**. Provide explicit, permission-gated, namespaced key/value storage operations with read/write/delete and transaction/serialization boundary. Persist across **server process restart**, not merely in a global JS map. No ambient access to ungranted paths, sibling stores or symlinks. Atomic commit, deterministic sequence ordering and recovery on failed writes. Keep the business record schema in user-authored H-Code.
4. **Sound effects + concurrency**. Mark request/server/storage operations effectful; reject them in pure contexts. Concurrent clients must not lose updates, see half-persisted records or double-apply operations on async replay. Effect journal must be request-scoped (with stable request identities) rather than erroneously shared across all requests.
5. **Rust + independent JS parity**. Extend actual Rust lexer/parser/AST/checker/emitter and JS reference independently; glyph and ASCII alias semantics must match. The engine may lower a generic HTTP server to a Node host adapter; its output is separately measured and has the same externally observed behavior.

## Frozen acceptance fixture design (to implement before code)

Create source-locked fixtures **without altering the preregistered registry**:

- A: `POST /items` valid payload -> 201 with generated deterministic ID; `GET /items/:id` -> 200 with exact record.
- B: `PUT /items/:id` validated replacement -> 200; restart server; `GET` returns the updated exact record.
- C: `DELETE /items/:id` -> 204; subsequent `GET` -> 404; restart and confirm still deleted.
- D: Bad JSON, missing required fields, invalid field types, unknown extra fields, malformed ID -> 400 with no state changes.
- E: Unknown route and missing record -> 404; unsupported verb on known route -> 405.
- F: Duplicate key and conflicting concurrent updates -> deterministic ordering and defined 409/serialization contract, never silent lost updates.
- G: Simultaneous operations from >=2 clients on a fresh seeded store, with a replay/cancellation case: exactly one committed effect per accepted operation.
- H: Security: deny disallowed binding, data paths, traversal/symlink targets, excessive body, excessive outstanding requests and invalid UTF-8 before mutation.
- I: Restart/crash recovery: persist committed records, reject partial writes; kill/restart only at defined host-IO fault injection points.
- J: Negatives: six or more ill-typed/effectful H-Code programs rejected by **both** frontends.

Fixtures must record exact request/response bytes, status and persisted state, be checked under Windows and Ubuntu, and include generated seeded cases with independent expectations. Normalization of ephemeral port numbers is allowed in logs, not of data or responses.

## Required implementation slices

- **B0 — independent contract**: fixtures, TypeScript correctness oracle, signed/sha-locked source inputs and failing tests that detect missing H-Code server support. No status promotion.
- **B1 — typed server host operations**: real parser/checker/emitter and independent JS implementation, loopback server and strict caps. CI must pass with negative effect and type tests.
- **B2 — persistent transactional key/value API**: granted root, atomicity, crash recovery, concurrent serialization and per-request replay exactly-once checks.
- **B3 — genuine user-authored CRUD service**: implement validation, methods, routing and state transition **in H-Code**, then run Rust→Node ESM, independent JS interpreter and standalone TypeScript correctness oracle with the same fixtures.
- **B4 — verification gate**: a `benchmark20:verify12` command executes exact-source SHA-locked tests; only then may `canonical20-coverage.mjs` derive 12/20. The strict 20/20 gate must remain red while any other task is unsupported.

## Compression ledger

Measure Unicode codepoints and UTF-8 bytes of **all developer-authored H-Code files** vs a competitive idiomatic TypeScript implementation of the same API. Independently list used package versions, lockfiles, installed dependency footprint, compiler-generated JavaScript bytes, execution memory, elapsed compile/test time and limitations.

A small H-Code entrypoint delegating its entire CRUD implementation to a library must count the developer-authored library code. The standalone TypeScript correctness oracle is NOT automatically the fair, competitive TypeScript benchmark. Do not claim >=70% global median until all 20 tasks pass.

## Exit criteria

No main merge unless exact-head CI (Windows/Linux, security checks) passes. A contract-only draft may merge solely as groundwork but **never** marks task12 verified or working; real M19.12 implementation remains pending.
