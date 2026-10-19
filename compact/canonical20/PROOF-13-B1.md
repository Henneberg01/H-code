# M19.13 B1 — real browser DOM language capabilities

Canonical13's original preregistered contract is **interactive required/email validation with accessible error feedback**. The canonical 20-workload registry remains unchanged. M19.13 B1 adds reusable browser capabilities, **not** a hardcoded form macro, and does **not** count task13 as fully verified.

| Symbol | ASCII alias | Typed signature | Browser semantics |
|---|---|---|---|
| `⟐` | `dom_value` | `String → String` | Read input value or text content |
| `⟑` | `dom_text` | `(String,String) → Unit` | Write `textContent`, never `innerHTML` |
| `⟒` | `dom_valid` | `String → Bool` | Read browser's native `checkValidity()` |
| `⟓` | `dom_on` | `(String,String,(String)→Bool) → Unit` | Register event; reject default on callback `false` |
| `⟔` | `dom_attr` | `(String,String,String) → Unit` | Safe attributes: `aria-*`, `role`, `title`, `data-hcode-*` |

All five are genuine typed intrinsics in Rust's lexer, typed identifier resolver and JavaScript emitter, with a separate JavaScript-reference interpreter implementation. The Unicode signs are primary syntax; ASCII spellings are accessibility fallbacks only. No templated form functionality is introduced into the compiler.

## Try the user-written form

```sh
cargo run --quiet --manifest-path compiler/Cargo.toml -- build \
  compact/canonical20/programs/13-form-validation-ui.hc \
  --out compact/canonical20/programs/13-form-validation-ui.mjs
python -m http.server 8000
```

Then navigate to `http://localhost:8000/compact/canonical20/programs/13-form-validation-ui.html` in a browser. The HTML5 `required` and `type=email` rules belong to the HTML document; H-Code observes `checkValidity()`, handles input/submit events and updates `aria-invalid`, live errors and a text-only preview. Invalid submit is prevented by the event handler returning Bool `false`. Valid submit retains normal browser behavior, so the sample does not supply a backend at its `/submit` action.

## Threat model and compatibility

- DOM access only in a real browser, or through an explicitly injected test/reference DOM host; no implicit server-side DOM and no network fetches.
- CSS selectors and text are bounded; invalid/missing elements fail closed.
- `textContent` prevents HTML execution; attribute names have a strict allowlist; unpaired Unicode surrogates are rejected.
- Event names are restricted and registration is limited to 256; callbacks must return Bool; no `eval` or `innerHTML`.
- Signed pure package operations cannot refer to these browser effects. Replayable CAS HTTP reducers cannot invoke them via named H-Code functions.
- Existing standalone CLI/HTTP programs generate no DOM runtime prelude unless they reference browser intrinsics. Existing Canonical12 source locks and readiness proofs remain unchanged.

## Verification status

`npm run m19:browser-dom` runs symbol/alias lexer equality, mock browser event and accessible-feedback cases, independent H-Code JS interpreter versus Rust-compiled emitted JS behavior, and misuse guards on Windows/Ubuntu. `cargo test --manifest-path compiler/Cargo.toml --test m19_browser_dom` tests the Rust type checker and typed emitter, including rejected pure-library and wrong-type programs.

**B1 is not the final Canonical13 proof.** A complete browser-based three-engine suite (actual DOM, real keyboard/form events, original preregistered acceptance and an independent idiomatic TS baseline), accessibility audits and fair authored-source/UTF-8/compiler/runtime measurements are still required before moving from **12/20 to 13/20** or claiming any percentage against TypeScript.
