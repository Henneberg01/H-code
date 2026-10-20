# Canonical16: signed stateful sessions

Concrete fixture established on 2026-10-20 for the original acceptance:
`issue/rotate/revoke a signed session using deterministic fixture identity`.
The twenty-task registry retains Git blob
`46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` and its original statuses. A
separate executable verifier derives readiness; a registry label is not proof.

## Contract and implementation

Commit `01cef3b86b361eafc6accd2b78a6a3be6b20108e` freezes the protocol,
identity, public test credential and six HTTP flows before either application
is added. The brief had no earlier concrete task16 application snapshot. The
contract manifest has Git blob `02cc17e1be5578550837568c77c639dcb4860d51`;
the application manifest independently locks every delivered source file.
The loader rejects changed fixtures, manifests, source, hidden files and
symlinked source files. Earlier workload source locks remain unchanged.

The native application uses generic typed `✍(key,message)` / `✓(key,message,tag)`
operations and existing CAS persistence. These operations use standard Node
HMAC-SHA-256, canonical lowercase 64-hex tags and full 32-byte constant-time
comparison. The independent language reference has a separately written crypto
adapter. Both traverse operands for type and transitive effect checks. Generic
key/message bounds are 4,096/65,536 UTF-8 bytes. No identity or route policy is
implemented in the compiler or test host.

Both applications read `data/signing-key.txt` with an explicit file-read grant;
there is no default key. Application keys contain 32–1,024 Unicode scalars.
UTF-8 BOM is preserved as actual key bytes, and malformed UTF-8 is rejected.
The native runtime's file reader now namespaces its imports so it composes
with CAS emission without duplicate JavaScript bindings. A regression test
checks the emitted combined program with Node's syntax checker.

POST `/session` checks exact JSON fixture credentials, increments the durable
generation and returns `{generation,identity,signature}`. GET `/session`
authenticates the supplied `x-session-signature` against the current durable
generation. POST `/session/rotate` advances generation; POST `/session/revoke`
persists revocation and returns 204. Old tokens fail after rotation, reissue,
revocation or signing-key replacement. Unsafe-integer exhaustion returns 409
without mutation. Missing, malformed or duplicate signature headers fail.

The optional five-field HTTP envelope preserves lowercase raw header
occurrences. More than 128 header pairs are rejected before the callback.
Header-bearing idempotency digests bind those occurrences, while legacy
envelopes retain their original digest. The session policy rejects every
`x-hcode-request-id`: replaying a stored mutation response after rotation
could otherwise return a stale authentication success. Authentication checks
always observe current state. Responses use no-store; malformed/oversized
bodies, invalid credentials, extra fields, unknown routes and wrong methods
have explicit tested outcomes.

These are symmetric MAC-authenticated stateful sessions for **one fixture
identity**, not asymmetric digital signatures, JWTs or a production account
provider. The contract includes explicit rotation/revocation, without expiry.
Password storage, TLS, cookies, CSRF, multi-host availability and power-loss
durability are outside this proof.

## Actual execution evidence

`npm run benchmark20:test16` builds the current Rust compiler and starts real
loopback HTTP processes for three execution paths:

- Rust-compiled native JFH-CODE with durable CAS state.
- Independent JFH-CODE language interpretation with a trusted generic HTTP/CAS
  host. The language evaluator is independent; this path shares native HTTP
  and CAS infrastructure and is not a third independent storage engine.
- Independently authored TypeScript using Node HTTP/crypto and SQLite with
  synchronous full-durability transactions. Requires Node 22.13+.

An independent expected-state model calculates canonical claims and MACs from
the known public fixture key, rather than trusting returned tokens. Tests
check response status, exact body, content type, no-store and bodyless 204.
Six fixed and eight generated scenarios run in all three paths, plus a
maximum-generation scenario for each path:

| Evidence | Observed |
|---|---:|
| Fixed / generated / generation-boundary runs | 18 / 24 / 3 |
| HTTP assertions | 888 |
| Graceful and forced restarts combined | 78 |
| Forced process crashes | 45 |
| Concurrent rotation pairs, exactly one winner each | 42 |
| Signing-key replacements retaining generation | 12 |
| Rejected startups with diagnostic checked | 18 |
| Deliberate policy faults rejected by HTTP assertions | 9 |

Startup negatives cover missing, short, long and invalid UTF-8 keys, a short
BOM-prefixed key and denied file capability. Generated runs include a
BOM-prefixed minimum 32-scalar key and a maximum 1,024-emoji/4,096-byte key.
Invalid JSON surrogate strings return 400 consistently. Maximum-generation
stores are preseeded through each storage implementation; issue/rotate fail
without invalidating the still-current token, and revocation survives crash.
Races authenticate and mutate atomically. Faults independently disable MAC
verification, reuse rotation generation or ignore revocation in each path.
Compilation failures, launch failures and timeouts do not count as rejected
policy faults; only actual expected HTTP assertion failures count.

Generic HMAC tests separately verify the published RFC4231 Jefe vector,
aliases, type/arity failures, malformed tags, UTF-8 bounds, exact Unicode
bytes, pure package usage and nested effect rejection. Raw-header tests check
duplicate preservation, header budgets and header-bound receipts. The complete
Rust suite passes 226 tests; the language reference passes 181 and Studio 17.

## Source accounting

All delivered application code is counted, including type declarations,
credential validation, startup/configuration and persistence glue. Neither
language calls a task-specific host helper. TypeScript uses maintained SQLite
provided by Node rather than an invented persistence algorithm. Benchmark
drivers, neutral fixtures and test-only reference hosting are not application
source and are reported separately.

| Source | Unicode codepoints | UTF-8 bytes |
|---|---:|---:|
| Whole JFH-CODE application | 2,403 | 2,784 |
| Whole independent TypeScript application | 7,762 | 7,762 |
| Reduction on this workload | 69.04% | 64.13% |
| Common frozen fixture JSON | 8,453 | 8,453 |
| JFH-CODE including common fixtures | 10,856 | 11,237 |
| TypeScript including common fixtures | 16,215 | 16,215 |
| Reduction including common fixtures | 33.05% | 30.70% |

Current generated native ESM is 50,283 bytes, SHA-256
`f5ea0e33ec7519a55d2eec6115cbffc2f4f78973224a7fb86d9063924100ebe3`.
The verifier measures it anew. It is not handwritten source and is not zero.
There are zero external npm dependencies in these apps; Node, Rust, SQLite
and toolchain/runtime storage are not measured here and are not zero-cost.
The public key is contained in the shared fixture JSON and materialized as
test input. No production secret belongs in the benchmark.

The source reduction is below 70% even on this task alone. It cannot establish
the global twenty-task median, runtime speed or AI-token savings. Conditional
readiness becomes 19/20 only when every current proof passes. Task 17 remains
unsupported, and the aggregate's real Chromium timeout remains an independent
blocker; targeted session success does not authorize skipping browser checks.

```sh
npm run benchmark20:verify16
npm run benchmark20:test16
HCODE_CHROME=/usr/bin/chromium npm run benchmark20:test
```
