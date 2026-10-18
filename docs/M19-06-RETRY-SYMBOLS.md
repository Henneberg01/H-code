# M19.06-B2 — symbol-native retry policy and scheduler

The canonical 06 source in `compact/canonical20/programs/06-http-retries.hc` is real H-Code. The policy is executed by Rust-generated JavaScript and independently by the JS reference interpreter. Neither primitive `⤋` nor `⏳` hides an algorithm or task-specific macro.

- `⤋ URL`: HTTP GET with exact typed response and explicit origin capability.
- `⏳ milliseconds`: generic bounded async delay 0..120,000ms. Production waits real time; explicit `HCODE_TEST_VIRTUAL_SLEEP=1` supports deterministic CI.
- `⎙(value)`: intrinsic sign for existing `print(value)`; `⌨` reads URL.
- `⟳`, `⊢`, `⊣`, `∧`, `∨`, `≡`: source-level retry loop, branches and status checks.
- `⤒` with typed record/sequence produces the trace.

The source implements at most 4 GETs; retries only 429/500/502/503/504 and network errors (status 0), bounded exponential delay 100/200/400 ms capped at 1000 ms, numeric Retry-After override, immediate stop for 400/404, deterministic decision/attempt/wait traces. The H-Code JSON transport uses status 0 and reason `""` as null sentinels; the independent verifier maps them back to null for the frozen contract. The original six cases and canonical20 registry must not be changed.

The independent JS async interpreter uses bounded typed effect replay (no duplicate network requests or delays) for top-level H-Code source; this is not yet general async functions.

Full canonical certification and aggregate >70% source reduction remain separate gates; do not promote 6/20 until equivalent execution, exact SHA locks, negative cases and Windows/Linux CI are confirmed.
