# M19.12 B2c — Crash recovery and cross-process transactional state (design gate)

**Status: design, NOT implemented.** Do not change Canonical20 11/20 or the original `workloads.json` SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`. The global ≥70% authored-code median remains unproven. This design is stacked on B2b and must be rebased cleanly against merged `main` before implementation or review.

## Existing generic H-Code contract, retained

The same core language sign `⤊` (ASCII `http_serve`) accepts `⤊(reducer, initialState)`. User-authored H-Code owns every route, validation rule, state transition, and response. The reducer remains typed as

`(⦃body:String,method:String,path:String⦄,String) → ⦃body:String,state:String,status:Number⦄`.

B2a stores one bounded String state in a host-granted directory, serializing one server process with an exclusive lock file. B2b retains stable, durable request-ID receipts, the method/path/body/content-type digest, and the response status/body in the same atomic state revision. B2b currently limits durable receipts to 128 and does not silently evict.

**Known critical gap:** Windows or Linux `SIGKILL` can leave the lock file behind, preventing restart. Do not solve this by deleting lockfiles based on a timed lease, PID existence alone, or a non-atomic check-then-remove sequence: those can produce two simultaneous writers. Manual removal is not an automatic safe-recovery strategy.

## Proposed crash-safe design: immutable revisions with atomic compare-and-publish

Explore a bounded, opt-in, generic host backend `HCODE_HTTP_STATE_MODE=cas-v1` with these constraints:

1. **No persistent global lock.** State is a series of immutable, consecutively numbered revision files (e.g., `rev-000000000001.json`). Each holds `schema`, exact revision number, bounded current state, and all unexpired-to-date durable request receipts. Initially the approved root is empty. The existing `hcode-http-state.json` backend remains supported unchanged; never silently mix both backends in the same root.
2. **One atomic writer wins.** Compute a next revision in an exclusive randomly named temporary file in the same directory. Flush the file, then publish with a same-filesystem **hard-link-create-if-absent** (or an independently proven equivalent create-only operation). Never use overwrite rename as an optimistic CAS: it can lose updates. After publication flush the directory where supported. A losing writer detects `EEXIST`, reads the winning committed revision, re-evaluates the H-Code reducer on the new state, and attempts again with a bounded retry count. If the filesystem cannot support the required atomic create-only publish, **fail closed**.
3. **Crash before publish:** a temporary file may remain, but no revision is visible and no operation is counted. Subsequent startup must not treat incomplete temporary files as committed data. Uncommitted temporary cleanup must be safe against simultaneous live publishers; nonessential cleanup may be deferred.
4. **Crash after publish, before reply:** the committed revision already contains the response and SHA-256 receipt for the stable request ID. Replaying the same ID and digest must return its exact previously committed status and body without executing the reducer or applying the state transition again. Different digest under the same ID must return 409.
5. **Read-only semantics:** a `GET`/`HEAD`/`OPTIONS` handler must not publish a changed state. Validate input and response bounds before publication. Check canceled/disconnected requests before commit, with honest documentation that post-commit network failures can still occur and must be retried using an ID.
6. **Concurrency:** start two or more *independent processes* in the same approved root, each serving localhost on an independently granted port. Concurrent distinct-ID requests must serialize through version compare-and-publish and produce no lost updates or torn reads. Concurrent identical-ID requests may race but only one receipt/state revision may commit; the loser must re-read and return the winning receipt, not recompute a second mutation.
7. **Bounded retained history:** set an explicit revision ceiling (initial research target 256) and persist all B2b receipts with the existing 128-entry ceiling, no silent receipt eviction. Before any quota exhaustion return a documented safe error without altering data. Report total disk footprint separately; 256 full snapshots are a deliberately bounded research baseline, **not** production storage efficiency.
8. **Tamper/fault safety:** verify canonical absolute approved root, disallow symlinked root and revision files, malformed UTF-8, invalid schemas, mismatching revision names, missing revision numbers, duplicate receipt IDs, and oversize state before accepting requests. Do not silently skip corrupt committed revisions. Reject mixed legacy `hcode-http-state.json` and CAS state roots until an independently verified migration protocol exists.
9. **Pure/replay-safe reducer:** cross-process CAS retries can re-run user-written reducer code. Review existing H-Code function effect checking and reject ambient effects (including transitive printing or other I/O) in a retriable state reducer, or model all permitted effects in a request-scoped journal. Returning a pure new state and response from source H-Code is allowed; silently repeated externally visible side effects are not.
10. **Platform contract:** validate Windows/NTFS and Ubuntu/Linux filesystem semantics, including hard-link atomicity, file and directory syncing behavior, error codes, permissions, and process termination. Platform-specific limitations must be exposed, not normalized away.

## Source-locked acceptance tests — required before claiming B2c

| ID | Real externally observable check |
|---|---|
| C01 | Crash before publish leaves no committed new state, restart works without manual lock deletion |
| C02 | Crash immediately after publish before HTTP response; replay same ID returns original committed status/body exactly once |
| C03 | Two separate servers sharing one approved root, 32+ distinct-ID simultaneous increments, all successful mutations retained |
| C04 | Two separate processes receive the same ID simultaneously; one commit, one replay, exactly one new state transition |
| C05 | One key repeated with different method/path/body/content-type → 409, unchanged durable state |
| C06 | The first process `SIGKILL`s while another process continues to serve and commit; subsequent new process safely rejoins |
| C07 | Valid B2b v1/v2 legacy state files remain usable with legacy mode; mixed mode fails closed until explicit migration |
| C08 | Corrupted/missing/oversized/symlinked committed revisions block startup without modifying external targets |
| C09 | Fault-injection on `EEXIST`, fsync, hardlink and quota paths never overwrites a winning revision |
| C10 | Rust-generated H-Code ESM, independent JS interpreter reducer and independent TypeScript behavioral oracle agree on all frozen external traces |
| C11 | Existing B1/B2a/B2b regression suites remain green on Windows and Ubuntu |
| C12 | Compiler type/effect negatives reject malformed reducers and disallowed nested/ambient effects on both frontends |

Fault injection must be explicitly gated to test builds or trusted host configuration, never enabled by ordinary web requests. Never fake success by mocking HTTP requests: use real sockets, actual files and independent OS processes. Keep the frozen six canonical12 CRUD cases and registry untouched.

## Implementation/review plan

- **B2c-0:** build contract fixtures and a failing process-crash / dual-process test harness. Do not mark functionality complete.
- **B2c-1:** implement opt-in immutable revision compare-and-publish store, backward-compatible with the old mode in isolated roots.
- **B2c-2:** integrate typed reducer retry around CAS conflict, existing receipt replay and explicit effect rules, with independent JS/TS observational checks.
- **B2c-3:** exhaustive fault-injection and exact-head Windows/Linux CI + CodeQL; only after green review may B2c be merged.

**Not yet included:** full user-authored CRUD API (B3), fair competitive TypeScript baseline, full immutable 20-task source-locked proof or 12/20 promotion (B4). Do not represent the research persistence store as a security sandbox or crash-durable database without these gates.
