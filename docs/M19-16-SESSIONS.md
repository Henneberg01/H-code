# M19.16 B2a — sessions written in JFH-CODE

`compact/canonical20/candidates/16-session-engine-b2a.hc` implements issue,
inspection, rotation, revocation, expiry and secure cookie construction in
actual symbolic source. The compiler contains no session-specific operation.
The frozen B0 oracle, fixtures and Canonical20 registration remain unchanged.
Canonical16 is still incomplete; overall coverage remains 15/20.

## General state operation

`⥁(transition,initial)` accepts a synchronous `String → ⦃state:String,value:String⦄`
function and returns the String result value after committing the returned
state. The secondary accessibility alias is `state_transaction`. SQLite
`BEGIN IMMEDIATE` serializes separate processes. The callback runs once;
there is no implicit retry or durable response receipt. Only `state` is stored.
Callback exceptions or invalid results roll back. An acknowledged committed
state may outlive a process that exits before delivering stdout, so this
primitive does not promise delivery or idempotent command replay.

The explicit host capability `HCODE_TX_STATE_ROOT` must name an existing
canonical directory. On POSIX it must belong to the process user with no
group/other permissions. Its fixed `state.sqlite` is created with mode 0600;
symlinks, hardlinks, nonregular and overly permissive existing DB files are
rejected. The directory is trusted host storage, not an adversarial filesystem
sandbox. Windows ACL isolation is the host's responsibility and still awaits
execution on Windows. The host must not share a directory between unrelated
programs or modify its contents while programs are using it.

Limits: 1 MiB UTF-8 state, 64 KiB result, 64 transactions per evaluation,
5-second SQLite busy timeout, existing language execution/JSON/sequence limits.
Transactions cannot nest or run in pure packages, sort keys or CAS reducers.
Outgoing HTTP, delay and file-write replay cannot coexist with `⥁` in a source
program, including dead branches. The reference `executeAsync` also denies it.
Other callback side effects are not undone by state rollback; HMAC and entropy
are permitted in synchronous transitions.

## Trusted command interface

Compile the candidate with `hcodec build <source.hc> --out session.mjs` and run
the generated ESM with Node 22.13+ or Node 24. The host supplies
`HCODE_TX_STATE_ROOT` and B1 `HCODE_CRYPTO_GRANTS`: a `session` key alias with
sign/verify permissions and random permission. Keys belong to the host; they
never appear in `.hc` or compiled source. Tests use public fixture keys only.

One stdin JSON object contains `op`, `identity`, `token`, `now`, `ttl`. Types
are String/String/String/Number/Number. Operations are `issue`, `inspect`,
`rotate`, `revoke`. Timestamp is integer epoch seconds, TTL is 1..86400.
Identity and clock inputs are provided by the trusted host. This CLI is not
a public login/authentication endpoint and does not establish user identity.

The response contains `ok, identity, issuedAt, expiresAt, token, cookie, error`.
Errors are `invalid`, `conflict` or `capacity`; capability/runtime failures fail
the process. New token/cookie values appear only on issue/rotation responses.
They use the frozen `v1.id.mac` format and `hcode-session/v1/` HMAC domain.
`⚄18` generates 144-bit random IDs, `⊩` signs, `⊨` verifies canonical MACs,
and `⌁` hashes IDs before persistence. Cookie flags match B0 exactly.

State records contain only ID hash, identity and issue/expiry/revocation
timestamps. Rotation invalidates the old session and inserts the new one
atomically, preserving absolute expiry. Collisions leave both prior sessions
intact. Expiry is exclusive; revocation is idempotent. Expired/revoked rows stay
as tombstones; the prototype refuses new rows at 1024. Automatic cleanup and
unlimited production storage are not claimed. Existing scalar/input limits can
reject very large malformed tokens before the semantic `invalid` response.

## Evidence and remaining work

`scripts/m19-session-engine.test.mjs` compares the real Rust-generated program
and independent reference interpreter with the unchanged B0 TypeScript oracle.
It covers all five frozen scenarios, actual database reopening, malformed and
wrong-key tokens, TTL/time validation, duplicate rollback, exclusive expiry,
key/entropy denial, capacity and competing rotation processes. Database bytes
are checked for absence of raw IDs, bearer tokens and fixture signing material.
The deterministic entropy preloader is test-only and is never linked into the
candidate or generated production program.

The generic counter tests separately establish that `⥁` has no auth policy,
including simultaneous first DB creation, restart, runtime purity and rollback.
See `docs/evidence/m19-16-b2a-linux.json` for the exact local checks.

B2b must integrate real HTTP Cookie/Set-Cookie transport with a trusted clock
and identity provider. B3 still needs full fixed-task parity and the fair
idiomatic TypeScript comparator/source accounting. Hosted Ubuntu/Windows CI
and required security scans remain pending; GitHub previously reported an
account billing lock. No Canonical16 completion or global 70% reduction is
claimed, and no merge/release is authorized by this candidate.
