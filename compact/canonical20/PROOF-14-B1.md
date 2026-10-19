# M19.14 B1 — browser storage as first-class H-Code effects

The immutable Canonical14 task (`14-todo-app`) requires **add/complete/remove with persisted state and accessible UI updates**. This B1 milestone implements reusable persistence primitives; it does NOT implement or verify the entire todo app. Keep the Canonical20 registry's SHA/acceptance unchanged and its derived status at **13/20** until full task14 proof.

## Intrinsic typed language operations

| Glyph | ASCII accessibility spelling | Type | Real browser behavior |
|---|---|---|---|
| `⟕` | `store_get` | `String → String` | Read same-origin `localStorage`; missing key returns empty string |
| `⟖` | `store_put` | `(String,String) → Unit` | Write text synchronously with browser quota enforcement |
| `⟗` | `store_del` | `String → Unit` | Remove a stored value |

These are intrinsic symbols in the H-Code Rust lexer, typechecker and JavaScript emitter. The independent JavaScript reference interpreter implements the same operations using an explicit `storageHost` dependency (no implicit Node files, globals or fake values). UTF-8 string arguments are checked dynamically as well as statically; keys must match `hcode:[a-z][a-z0-9._-]{0,63}` (namespaced and at most 71 ASCII bytes). Values are at most **65,536 UTF-8 bytes** and must be well-formed Unicode. The size guard applies to reads as well, including preexisting oversized data. Single-key writes are synchronous; Browser `QuotaExceededError` and origin privacy constraints remain observable errors, not silent success.

**Not a secrets vault**: Browser localStorage has no encryption and shares its origin with other origin scripts. Do not persist authentication tokens. This API does **not** offer compare-and-swap, multi-tab transactional semantics, cross-origin access, or server-side persistence. It is intentionally browser-only and excluded from H-Code pure package definitions/CAS HTTP reducers; core names and glyphs cannot be redefined.

## Runnable H-Code source

The user-authored `compact/canonical20/programs/14-browser-storage-demo.hc` reads a key, updates accessible `#before` and `#after` DOM outputs and persists the new value. Browser fixture: `14-browser-storage-demo.html`. Build:

```sh
cargo run --quiet --manifest-path compiler/Cargo.toml -- build \
  compact/canonical20/programs/14-browser-storage-demo.hc \
  --out compact/canonical20/programs/14-browser-storage-demo.mjs
python -m http.server 8000
```

Open `http://localhost:8000/compact/canonical20/programs/14-browser-storage-demo.html` and refresh: the second load shows the previously persisted text.

## Tests and acceptance gates

```sh
cargo test --manifest-path compiler/Cargo.toml --test m19_browser_storage
npm run m19:browser-storage
npm run m19:browser-storage-real
```

Rust tests require typecheck/alias correctness, purity exclusion, shadowing protection and only selective runtime injection. The JS tests compare effect order and output across the Rust-generated browser ESM and independent H-Code interpreter for repeated executions, missing host, invalid keys, byte quotas and deletion. The real Chromium test **restarts the browser process using the same same-origin HTTP endpoint and profile**; it requires the second process to read the first process's stored value and render it via native H-Code DOM glyphs.

**Next: B2/B3** general list/task operations through ordinary H-Code list and record syntax, actual add/complete/remove, persisted source-locked behavior and independent idiomatic TypeScript competitor. Never introduce a todo-specific core symbol: generic typed features should reduce developer-authored source rather than hiding app code inside the runtime.
