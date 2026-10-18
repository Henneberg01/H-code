# M19.06-B3 — canonical workload 06: real typed HTTP retries

## Frozen original acceptance

The preregistered **20** tasks remain exactly unchanged, Git blob
`46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`. Original task06:
**"fake 500/429/200 responses, bounded retries and deterministic trace"**.
All twenty tasks remain in the readiness denominator.

## Language implementation, not an application-specific macro

- `⤋` / `http_get`: intrinsic typed HTTP(S) GET from the Rust lexer to ESM emitter;
  JS interpreter implements its own constrained async replay. The runtime requires
  an explicit `HCODE_HTTP_ALLOWED_ORIGINS` on Node, rejects unapproved egress,
  embedded URL credentials and redirects, and bounds a response to 64KiB UTF-8.
- `⌛` / `sleep_ms`: a **separate reusable** effect-typed delay in integer
  milliseconds. Rust checker rejects String values and effects within pure
  functions/lambdas; runtime rejects negative/fractional/nonfinite/excessive
  durations; at most 64 delays and 120 seconds aggregate. JS interpreter
  supports a trusted `sleepMs` scheduler (for deterministic test replay).
- `compact/canonical20/programs/06-http-retries.hc` is **actual user-authored
  algorithmic H-Code**. It owns HTTP retryable status selection, terminal
  results, exponential backoff, `Retry-After` and bounded four attempts. The
  compiler and interpreters contain *no* task-specific retry policy.
- Neither compiler-generated JS nor runtime implementation bytes are included
  in the developer-written source count. Outputs are **not** assumed safe for
  arbitrary untrusted programs; the HTTP origin capability is limited.

## Exact source locks

| File | Frozen Git blob SHA-1 |
| --- | --- |
| Preregistered 20-task registry | `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` |
| Six immutable task06 HTTP fixtures | `4f12a085d9730ac637444a06fff6f75481985efb` |
| H-Code authored HTTP retry program | `8abedc2d8fa32fa6ec157bb98d3a64a02408dfda` |
| Independent TypeScript correctness oracle | `1e9f968d900ed9ab77c703afad1fec104135a83d` |

## Verified acceptance

`npm run benchmark20:verify06` executes the **six frozen** cases and
**ten additional generated** response patterns against separate, genuine
ephemeral 127.0.0.1 HTTP servers in each of **three execution engines**:
independent TypeScript fetch reference, JavaScript H-Code interpreter with
journaled effects, and real Rust-compiled H-Code emitted to Node ESM.

Each run checks the fully structured result (success, status, body, reason,
and every attempt/decision/backoff), exact request counts and bounded attempts.
The separate full-proof harness rejects **four invalid H-Code source programs**
in both Rust type/effect checker and JS reference interpreter, and verifies
that an ungranted HTTP origin makes zero network requests. New delay
intrinsic has additional dedicated Rust/JS runtime/negative conformance.

`npm run benchmark20:status` does not trust an edited JSON status; it executes
this complete live proof again and only counts task06 verified after all suites
exit green. `npm run benchmark20:strict` still intentionally fails until
**20/20** have full evidence.

## Separate size metrics — NOT the global compression benchmark

| Metric | Developer-authored H-Code | TypeScript correctness oracle |
| --- | ---: | ---: |
| Unicode codepoints | 776 | 3,112 |
| UTF-8 source bytes | 961 | 3,112 |
| Provisional relative source reduction | 75.06% | codepoints |
| Provisional UTF-8 reduction | 69.12% | bytes |

**These percentages describe this one source compared with an independently
written *correctness oracle*, not a pinned competitively selected idiomatic
TypeScript baseline.** Do not claim a 70% global median or claim
task06's performance is representative. The generated ESM size and SHA-256
are separately reported by `scripts/canonical20-verify-06.mjs` when its
live proof passes; not counted as authored H-Code.
The original historical M14 three-case median of 68.46% remains unchanged.

## Next work

Move from sequential top-level effects to genuinely concurrent typechecked
async H-Code, to meet original task08 (three fake endpoints with actual
parallel execution). Do not disguise multiple serial `⤋` effects as
concurrency.
