# M19.09 — original canonical workload 09: time-bounded associative cache

## Immutable preregistration

The original 20-workload registry remains at Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.
Original workload 09 acceptance is **"fake clock, set/get/expire, prevent stale reads and bounded memory"**.
Required capability names remain `map`, `time`, `state`; nothing is removed from the 20-task denominator.

## Real H-Code algorithm and general language change

`compact/canonical20/programs/09-expiring-cache.hc` contains the cache logic
as **developer-authored symbolic source**. It reads statically typed JSON events
from stdin, tracks a bounded associative map using typed records in a sequence,
filters expired records using `⌕` and typed inline `λ` closures, replaces
keys using functional filtering, appends via `⧺`, and returns a canonical
JSON trace via `⤒`. The cache is **not** implemented as an opaque one-character
app macro or a hidden TypeScript policy in the H-Code runtime.

A general-purpose Rust typechecker improvement infers typed record lambda
parameters from the sequence left operand **before** typechecking body field
references. It is shared by `⌕` and `⇢`, rejects unknown fields and
effectful operations in synchronous closures, and is regression-tested
independently of this cache.

## Fake clock and precise state semantics

The test host injects *virtual time* as explicit monotonic millisecond values
in `event.at`. No wall-clock, network, or host clock is accessed. This is
an event-driven simulated clock, **not** a new native `clock_now` intrinsic.
Inputs must follow this monotonic fake-clock contract; the H-Code program
does not promise arbitrary invalid-timestamp validation.

- A `set` writes `(key,value,expires=at+ttl)`; TTL `<=0` deletes that
  key without creating an entry. Re-setting an existing key moves it to the end
  of FIFO and replaces its expiry.
- Every event removes all entries whose deadline is `<=at`, so a `get`
  at exact expiry is a miss. A `get` does not affect FIFO order.
- At most **8** live keys exist. When a new key would exceed this bound,
  the oldest live key is evicted. `expire` triggers garbage collection.
- Each event emits a deterministic record with `hit`, `key`, `size`,
  and `value`. An absent key has `hit:false`, `value:""`.
- Storage is an associative **O(n) record sequence**, not an H-Code native
  hashmap and not a claim of O(1) lookups. The benchmark acceptance defines
  observable behavior, not asymptotic runtime guarantees.

## Exact source locks

| File | Git blob SHA1 |
|---|---|
| Original registry | `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` |
| Optimized user-authored H-Code | `c77479b480904950a1c059f5d920e4a78d31ed62` |
| Independent TypeScript correctness oracle | `f52e8006de9a1be27c44a48c1e17646df6fac4a1` |
| Six fixed fake-clock/TTL fixture traces | `1f03ef7b2b58cc760991f7e6585c7f92ef795954` |

## Required actual acceptance tests

`npm run benchmark20:verify09` must pass **6 frozen** traces and **15 seeded
generated** action streams (multiple temporal patterns and Unicode keys)
through all **three paths**: real Rust-compiled H-Code to Node ESM, the
independent JS H-Code interpreter, and the standalone TypeScript oracle.
Exact structured JSON, FIFO order, capacity bounds, stale reads, equality
at expiration and typed malformed-input denial are checked.

`scripts/canonical20-verify-09.mjs` replays the complete source-SHA-pinned
test suite before deriving task09 as verified in `npm run benchmark20:status`.
Changing only a registry JSON label is not enough. The strict 20/20 gate
must still fail until all original tasks are verified.

## Developer-written source reduction is NOT the global benchmark

| Measurement | H-Code | TypeScript correctness oracle |
|---|---:|---:|
| Unicode source codepoints | 460 | 2,180 |
| UTF-8 source bytes | 651 | 2,180 |
| Provisional codepoint savings versus this oracle | **78.90%** | — |
| Provisional UTF-8 savings versus this oracle | **70.14%** | — |

These figures are **only** relative to the independently authored
*correctness oracle*; they are not measurements against a competitively
selected idiomatic TypeScript implementation. They do **not** prove the
requested greater-than-70% global median. Generated JavaScript file size
and hash are reported separately; runtime and library footprints must
not be presented as authored source length.
