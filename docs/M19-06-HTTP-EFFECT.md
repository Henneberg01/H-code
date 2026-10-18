# M19.06-B1 — first genuine HTTP effect in the H-Code compiler

## Status and scope

The Rust compiler now owns a real, non-application-specific **⤋** prefix operation (ASCII fallback `http_get`). It performs an asynchronously awaited HTTP(S) GET and returns a statically checked exact structural record `⦃body:String,ok:Bool,retryAfter:Number,status:Number⦄`. This is an atomic transport effect **without retries**, not a disguised wrapper for canonical workload 06. A request accepts a String URL and has a 2000 ms timeout, no redirects, UTF-8 validation and 64 KiB body limit. Status `0` represents a transport error, while HTTP errors retain their real status and body. `retryAfter` is numeric milliseconds, zero unless a bounded numeric Retry-After is present.

```hcode
≔r←⤋"http://127.0.0.1:8000/example"
print(r·status)
print(r·body)
```

## Explicit I/O authority

Network is disabled by default. The emitting Node runtime refuses all I/O unless the embedding host sets **`HCODE_HTTP_ALLOWED_ORIGINS`** to a comma-separated, exact, non-wildcard list of permitted URL origins. Examples include `http://127.0.0.1:1234` and `https://api.example.com`. This is not a command-line bypass; output JS is independently protected even if someone compiles without executing via the H-Code CLI. Userinfo and non-HTTP schemes are rejected. Verified pure packages, current sync functions and sync lambdas cannot perform HTTP. These restrictions avoid silently introducing promises into existing sync functions; general async functions are future work.

The source lexer/parser in the independent JS reference interpreter recognizes the same symbol and ASCII fallback, but **the synchronous interpreter deliberately fails closed** for this asynchronous effect. Do not count it as JS runtime parity yet.

## Next, required before canonical verification

1. True asynchronous execution in the JS reference interpreter and controlled async function/call semantics in both engines.
2. A generic bounded sleep/scheduler effect (symbol) for deterministic retry backoff.
3. Author the retry policy in actual H-Code source (loops, conditions, state, trace), with no task-specific runtime macro.
4. Run real loopback 200/500/429/502/503/400/404 fixtures against Rust-generated JavaScript, the independent JS interpreter, and the fixed idiomatic TypeScript oracle.
5. Source lock and same-output verification in Windows/Linux, with exact character/codepoint/UTF-8 and generated JS/dependency reporting. Only then move readiness from 6/20 to 7/20.

The original canonical20 registry and six-case fixture remain unchanged. No claim of 70% aggregate achievement.
