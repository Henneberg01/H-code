# JFH-CODE M19.16 B2a — executable symbolic session logic

The owner authorized implementing the session logic and independently choosing
the technical details, with sign-first source and TypeScript-level capability
as the governing direction. Execute inline without another approval loop.

## Deliverable

Write issue/inspect/rotate/revoke/expiry and cookie construction in an actual
`.hc` program. It must use `⊩ ⊨ ⌁ ⚄`, typed records, functions, sequence
operators and control signs. No session policy is built into the compiler
or a JavaScript helper. Preserve the original B0 fixtures/oracle and all20
registration byte-for-byte.

B2a is a trusted command/response engine with real disk-backed SQLite state,
cross-process atomicity and real Rust/reference/oracle tests. HTTP transport,
Cookie/Set-Cookie integration and production identity/clock integration remain
B2b. Do not count Canonical16 as complete or claim global 70% from this stage.

## General language addition: ⥁

`⥁(transition,initial)` has type
`((String→⦃state:String,value:String⦄),String)→String`.
Secondary ASCII accessibility spelling: `state_transaction`.
It executes a synchronous caller-written transition exactly once inside a
SQLite BEGIN IMMEDIATE transaction. It reads/initializes one String state,
validates the returned record, commits only `state`, then returns `value`.
It never persists the result value, request, token or diagnostic response.
It is equally usable for counters, inventories or other state machines.

The explicit host capability `HCODE_TX_STATE_ROOT` identifies a pre-existing
canonical private directory. A fixed `state.sqlite` holds the generic state.
Reject symlinks, hardlinked/nonregular DB files, malformed state/result,
reentrant transactions, pure-package/sort/CAS use, promises and over-budget
state/value strings (1 MiB state, 64 KiB result). Database files are created
with mode 0600 where supported. Roll back on any callback/validation error.
No implicit retries of the H-Code transition and no response receipt journal.
Use a bounded SQLite busy timeout to serialize separate host processes.

Source-level outgoing HTTP/delay/file-write async replay and ⥁ cannot be
combined in one program. The reference synchronous evaluator accepts an
explicit `stateTransaction` host; executeAsync denies the effect. A real
source checker/linker rejects mixed effect programs before performing I/O.
HMAC/random effects are allowed in a synchronous transaction, but nested
transactions and calls from pure evaluation are denied. Other host effects
are not rolled back; the guarantee covers committed state, not external I/O.

## Session program

One typed stdin command supplies operation, deterministic fixture identity,
existing bearer token, trusted fixture timestamp and TTL. The CLI is a
trusted-host interface, not a public login endpoint. It does not accept an
arbitrary browser client's asserted identity/time as authenticated context.
Issue/rotate generate IDs via `⚄18` (144 entropy bits); tests inject original
deterministic IDs through trusted test-only entropy adapters/preloaders.

The `.hc` code validates identities/TTL/timestamps and parses `v1.id.mac`.
It checks `⊨` against `hcode-session/v1/` plus the ID, hashes IDs using `⌁`,
stores only hash/identity/issuedAt/expiresAt/revokedAt records, retains
revoked/expired tombstones, and caps the current prototype at 1024 rows.
Rotation invalidates the previous ID and preserves absolute expiry atomically;
duplicate IDs cannot revoke or overwrite an existing row. Revocation is
idempotent, expiry exclusive, and cookies use the original B0 secure flags.

Only the response channel returns new bearer tokens. Persistent state and
stderr must not contain IDs, tokens or key material. The original fixtures
and oracle remain immutable. Very large malformed inputs may be rejected
by existing language input/sequence budgets; no unbounded parsing promise.

## Verification

First observe failing native-sign/runtime tests, then implement the primitive.
Test generic counter restart, callback rollback, invalid result, denied root,
symlink/reentrancy/purity and two-process serialization independently of auth.
Compile the actual session `.hc` using Rust and run its output through Node;
interpret the same `.hc` independently and compare with B0's SQLite oracle.
Cover the five frozen cases, wrong key/forgery/malformed tokens, exact expiry,
duplicate-ID rollback, reopen, revocation, original expiry after rotation,
and two competing rotations where exactly one wins. Inspect real SQLite
bytes to ensure raw IDs/tokens/keys are absent. Run full Rust/Node regressions.
Source-count and byte measurements must not be sold as a competitive global
result before full HTTP task parity and the idiomatic comparator exist.
