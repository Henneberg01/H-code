# M19.12 B2b — durable HTTP request idempotency, not yet CRUD

M19.12 B0 and B1 are merged. B2a (PR #47) adds a typed generic
`⤊(reducer, initialString)` transaction and a host-granted single-writer
persistent state store, and this B2b layer adds a **durable request receipt**
journal. The H-Code source still owns its state transition algorithm; no route,
CRUD application, schema or fixture is implemented in the compiler.

## Idempotency contract

An HTTP client can send `x-hcode-request-id: <unique ASCII key>` on a
non-read request. Keys are 1–64 characters from `[A-Za-z0-9_-]`. The host
hashes method, route, decoded UTF-8 request body and content-type using SHA-256.
For an already committed key:

- Same request digest: respond with the original saved status and body. Do **not**
  run the H-Code reducer or write state again, even after graceful restart.
- Different digest: `409 idempotency_conflict`, no reducer call and no mutation.
- Invalid key: `400 invalid_request_id`, no mutation.
- New key: atomically persist the reducer's next state and exact status/body
  receipt **in the same file revision** before replying.
- `GET`, `HEAD`, `OPTIONS` must not change the durable state.

The state file upgrades from `{version:1,seq,state}` to
`{version:2,seq,state,receipts}` **only when receipt journaling is used**.
Existing B2a v1 files and no-key clients remain compatible. Keys are never
silently evicted; the first 128 unique received operation IDs are durable,
after which new keyed mutation returns `507 idempotency_journal_full`.
This is a deliberate B2 research bound, **not production unlimited storage**.

Requests **without** an idempotency key remain accepted for backward
compatibility but **are not guaranteed duplicate-safe**. Clients must supply a
stable key to obtain replay protection. The receipt journal is maintained
atomically with the existing single-process state file and does not itself
provide cross-process crash lock recovery.

## Security and correctness tests

`npm run benchmark20:state12b2b` covers exact response replay, conflicting
payload under one ID, simultaneous clients, invalid IDs, preserved state over
process restart, corrupt receipt rejection, independent H-Code JS reducer
parity and original B2a compatibility. Required Linux/Windows CI stays green.

## Remaining dependencies

- **B2c:** safe recovery from a stale lock after SIGKILL, failure injection,
  cross-process arbitration and stronger isolation/ownership controls.
- **B3:** the actual frozen task12 CRUD app authored in H-Code with validation,
  full REST routing and persistence; real compiler/JS/TS fixture parity.
- **B4:** exact locked proof/benchmark, fair idiomatic TS comparator, full CI
  and explicit promotion to 12/20 *only* if the preregistered acceptance passes.

Current Canonical20 remains **11/20** and the global source code reduction
median is **not established**. No hidden `crud` primitive is permitted.
