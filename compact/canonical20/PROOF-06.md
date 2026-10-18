# PROOF-06 — source-native glyph HTTP GET, bounded retries and scheduler

**Acceptance (unchanged):** `fake 500/429/200 responses, bounded retries and deterministic trace`.
**Fixed original SHA files:** registry Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`, canonical06 cases Git blob `4f12a085d9730ac637444a06fff6f75481985efb`.
**Source locks:** H-Code `9583fe5acf9d4a775ba7a4e86da46bd3b85b5cef`; idiomatic TS `1e9f968d900ed9ab77c703afad1fec104135a83d`.

Run `npm run benchmark20:verify06` (Node 22 and Rust). Windows/Linux CI also runs the gate and rejects incomplete proof. `npm run benchmark20:status` independently replays the gate before crediting task06: editing only a status label cannot promote it.

The 707-codepoint / 895-byte H-Code program uses native source syntax `⤋` GET, `⏳` async bounded wait, `⎙` print, `⌨` URL input, `⤒` JSON output, genuine `⟳` loop and `⊢`/`⊣` branches. Both the native Rust typechecker/emitter and the independent JavaScript H-Code interpreter execute source logic and produce deterministic traces. Neither transport nor sleep runtime contains task06 retry policy; no bespoke generated TypeScript is evaluated instead of the H-Code AST.

- **6 preregistered cases:** first 200, mixed 500→429→200 with Retry-After, terminal 400/404, 503 exhaustion, 502 recovery.
- **12 unseen, generated deterministic status/body sequences:** exercise successes 201/204/299, recovery, three retries, nonretryable 403/408/418/599, 429 Retry-After cap and Unicode body.
- **1 additional negative network transport scenario:** four network exceptions and 100/200/400 millisecond waits, no secret exception strings, no extra requests.
- The real server counts GETs, while JS/TS injected schedulers verify exactly-once waits; Rust generated JS uses a deliberately explicit virtual-clock test mode `HCODE_TEST_VIRTUAL_SLEEP=1`. Production waits real durations. Origin allowlist is mandatory, with 2-second per-request timeout and 64 KiB UTF-8 response cap.
- Rust compilation and independent runtime tests reject illegal type/effect use. `⤋`, `⏳`, `⎙` are reserved against signed-package shadowing.

| Measurement | H-Code | Developer-written TypeScript | Reduction |
|---|---:|---:|---:|
| Unicode codepoints | 707 | 3112 | 77.28% |
| UTF-8 source bytes | 895 | 3112 | 71.24% |

The reference TS implementation provides configurable retry bounds and an injected transport while the fixed H-Code case uses the canonical four-attempt configuration; therefore these are **measurements against the frozen canonical task06 baseline**, not a claim of identical optional API surface or a globally representative 70% reduction. Compiled JS bytes and SHA-256 are emitted by the proof tool; runtime npm dependencies are zero (Node built-ins), Rust compiler packages and deployment footprint are separate.

This proof upgrades only **one task** in the original fixed denominator of 20. The global median across all 20 remains **uncomputed** and the all20 70% objective **NOT MET**; do not confuse the task06 result with the overall target.
