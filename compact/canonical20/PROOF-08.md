# M19.08 — canonical workload 08, real simultaneous HTTP fan-out

## Fixed acceptance and immutable source locks

Original canonical workload 08: **"fan out to three deterministic fake HTTP endpoints and combine results without serial blocking"**. Registry remains all **20** original tasks at Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.

| Artifact | Frozen Git blob SHA |
| --- | --- |
| Original registry | `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` |
| Six deterministic, source-locked HTTP barrier cases | `bc3b3e4f6443d7c72cf76cc76a543b262b0505f9` |
| Developer-authored H-Code source | `1b948801e6f411a93f8de0581ccc34b7dbb4dc07` |
| Independent TypeScript correctness oracle | `9c7952f29ce910193c7eea7b4d6eb0c5705540e0` |

## General-purpose language capability

The existing typed `⤋` / `http_get` sign has a reusable overloaded meaning:

- `String → ⦃body:String,ok:Bool,retryAfter:Number,status:Number⦄` (backward compatible single GET)
- `⟦String⟧ → ⟦⦃body:String,ok:Bool,retryAfter:Number,status:Number⦄⟧` (genuine parallel GETs in original input order)

It is **HTTP vectorization**, not arbitrary effectful closure execution or an application-specific three-endpoint macro. Rust's typechecker requires String elements and effectful top-level execution; the Rust→ESM emitter uses a host-gated `Promise.all` batch. The JS reference interpreter implements an independent effect journal, invokes every trusted host GET before awaiting results, and replays deterministically. Max fan-out is 16, total HTTP calls per evaluation are bounded, a batch validates *all* schemes/credentials/origins before egress in the compiled backend, and a refused network grant fails closed. Neither runtime contains task08's app data transformation.

The user-authored workload08 program reads a typed JSON array from stdin, concurrently GETs it with one intrinsic sign, and produces a typed JSON list of the aggregated results. The TypeScript source separately implements equivalent behavior using built-in `fetch` and `Promise.all`.

## Actual parallel proof — not a mock clock speed

`npm run benchmark20:verify08` executes **six fixed** and **eight generated** scenarios, each through **three independent paths**:

1. Real Rust compilation → generated Node ESM → live 127.0.0.1 HTTP servers.
2. Independent H-Code JavaScript interpreter → trusted async real HTTP host → separate live barrier servers.
3. Standalone Node TypeScript correctness oracle → separate live barrier servers.

At least three of the frozen cases use three endpoints. More cases exercise zero, one, five, Unicode, HTTP 429/500/502, delayed/out-of-order arrivals, and Retry-After. The loopback server withholds **every HTTP response until all requests in the input have arrived**. Consequently, serial execution cannot pass the frozen result and request-count checks; measuring wall-clock time alone is not considered proof of parallelism. The test asserts complete ordered structured JSON results, response counts, no premature response release, original immutable SHA locks and a variety of unregistered generated cases. Additional checks reject **four invalid typed/effectful source programs** in both Rust and the independent JS interpreter; denied origins and over-limit fan-out issue no requests.

`npm run benchmark20:status` executes these proofs again before counting task08 fully verified. Changing a JSON status label alone cannot raise readiness. `npm run benchmark20:strict` must still reject until every original 20-task workload passes; no global 70% median is calculated yet.

## Reported size without hiding dependencies

| Measurement | H-Code | TypeScript correctness oracle |
| --- | ---: | ---: |
| Developer-authored Unicode codepoints | 123 | 1,549 |
| Developer-authored UTF-8 bytes | 145 | 1,549 |
| Provisional codepoint reduction for this one task | 92.06% | — |
| Provisional UTF-8 source reduction for this one task | 90.64% | — |

The H-Code compiler-generated JavaScript UTF-8 byte count and SHA-256 are reported **separately** by the verifier. This comparison is against an **independent functional correctness oracle**, *not* an independently selected, competitive idiomatic TypeScript baseline; no claim is made that the global 20-task median has reached 70%. All unverified workloads remain in the denominator.

## Next language work

Prove the originally registered **07 local file conversion** and **09 expiring cache** using general filesystem/state/time primitives with real permission limits. Avoid single-sign application shortcuts masquerading as a language runtime.
