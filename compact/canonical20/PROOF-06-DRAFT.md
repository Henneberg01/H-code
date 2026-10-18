# M19.06-B0 — historical HTTP retry fixture contract (NOT a compiler proof)

**Historical snapshot:** this describes the original B0-only stage. Subsequent
M19.06-B1/B2/B3 work implemented ⤋ GET, ⌛ delay, a real H-Code retry program and
an evidence-backed readiness checker. See [PROOF-06.md](PROOF-06.md) for current
results; the original wording below is kept for provenance.

The original canonical workload 06 is **unchanged**: `fake 500/429/200 responses, bounded retries and deterministic trace`. Registry Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` remains the source of truth. Workload 06 is still **unsupported** and **not** in the 6/20 fully verified results.

## Completed in this slice

- Six deterministic, source-frozen real loopback HTTP scenarios: immediate 200; 500->429->200 with standards-based `Retry-After: 1`; terminal 400; four 503s with exhausted attempts; 502->200; terminal 404.
- Real `127.0.0.1` ephemeral-port Node HTTP server; no outside network dependency.
- Developer-authored idiomatic TypeScript `fetch` reference implements bounded retries, timeout, status policy, exponential delay, `Retry-After`, failure reason and deterministic attempt trace.
- Test suite checks expected trace **and** real server request counts, network-error boundedness, invalid scheme/options and test server safety; CI on Windows and Linux.
- No source characters are claimed saved: there is **no executable H-Code candidate** yet. The TypeScript baseline is a functional oracle, not a benchmark win.

## Required follow-on work (in order)

1. Design a **general-purpose** effect-typed HTTP request operation plus async semantics, with meaningful Unicode sign and textual alias; don't hide a fully implemented retry algorithm inside a one-sign application macro.
2. Implement the exact operation in the Rust parser, checker and JS emitter, and separately in the H-Code JS reference evaluator with capability restrictions.
3. Implement bounded retries as actual H-Code-authored user source, using the same fixture/scheduler contract, not custom fixture-driven JavaScript.
4. Add source SHA locks, invalid-type programs, injected host-denial tests, executable Rust-generated JS/JS reference/TypeScript parity, and counts of H-Code/TS Unicode points, UTF-8, package source, dependencies and generated JS size.
5. Only after Windows and Linux exact-commit CI succeeds, extend the canonical20 readiness checker to count task 06 as fully verified. Do not edit the frozen registry's unsupported status to manufacture a result.

## Run

    npm run benchmark20:http-contract

Six cases are a starting contract, not complete acceptance: further randomized and negative cases belong in the future full compiler verifier.
