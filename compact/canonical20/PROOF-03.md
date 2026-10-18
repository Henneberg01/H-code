# Canonical 03 — full normalized Unicode word-frequency proof

**Original M19 preregistered task** `03-text-frequency-counter`, acceptance unchanged: **“normalize and count tokens; deterministic frequency ordering including Unicode cases”**. Registry SHA remains `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`; task IDs, weight and all other acceptance contracts remain exactly as originally registered. This is NOT a stand-in for counting individual UTF-16 code units or a one-off benchmark macro.

## The H-Code source is universal language logic

```hcode
ƒ frequency(s:String)→String ↩ ⤒(⧉(⟟s));
print(frequency("Red RED blue red BLUE"));
```

Here `⟟` is a real core operation `String → ⟦String⟧` that normalizes Unicode as **NFC → Unicode lowercase → NFC**, and then extracts words using **`[\p{L}\p{N}][\p{L}\p{M}\p{N}\p{Pc}]*`** with Unicode regex flags. It includes letters, digits, marks after the initial letter/digit, and connector punctuation. It is **not** full Unicode casefold, does not use language-dependent `localeCompare`, and does not claim ICU word-boundary parity for every human language. Emoji are treated as delimiters for words, not words themselves.

`⧉` is an independent, typed histogram: `⟦String⟧`, `⟦Number⟧` or `⟦Bool⟧` maps to immutable `⟦⦃count:Number,value:T⦄⟧`. It sorts String keys by Unicode scalar/codepoint order, numeric keys numerically, and Bool keys false-first. `⫶` independently splits a String into actual Unicode scalar elements (`⟦String⟧`) without UTF-16 surrogate-halves. It does **not** automatically lowercase or normalize the input. All three are real compiler AST/typechecker instructions and JS-reference operations, not TypeScript text replacements or hardcoded strings.

Accessible ASCII aliases: `text_scalars`, `text_words`, `text_hist`; Studio supports insertion of all three glyphs, and they are reserved against package glyph collisions.

## Execution, correctness and limits

- Fixed source inputs: **10 positive** cases — ASCII case, decomposed accents/NFC, Hebrew/CJK, emoji delimiters, Arabic-Indic digits, punctuation, empty input, Unicode sorting and Greek/Turkish lowercasing; exactly expected JSON `[{count,value},...]` results.
- **28 extra deterministically generated unseen Unicode inputs**, with expected outputs computed by a separately written independent oracle (not linked to H-Code runtime); must match the Rust compiler→generated Node JS, standalone H-Code JS reference and Node TypeScript.
- **6 invalid-typing source programs** statically rejected by the Rust compiler; independently rejected by the JS interpreter. Also **5 universal primitive execution tests** for Unicode scalars, Number/Bool and String histograms (including empty typed sequences and dangerous-looking key names). At least **16,385 tokens** must be rejected at runtime in Rust-emitted JS and the reference.
- **Bounded** to 1 MiB Unicode input / normalized text / aggregate string keys, 16,384 sequence items, finite Number histogram keys and valid Unicode scalar values. Output rows are immutable, null-prototype records; no unsafe Object.prototype access. Unicode operations are only shipped in emitted JS when actually used, not injected into unrelated programs.
- The tokenizer is intentionally explicit: Unicode word tokenization based on letter/number and subsequent marks/connector, **not** full grapheme segmentation or CLDR locale-specific lexical segmentation. Source NFC policy remains compatible with the original H-Code frontend.

## SHA-frozen authored-source comparison for *one of the original 20*

| Metric | H-Code | Idiomatic TypeScript | Reduction |
|---|---:|---:|---:|
| Developer-authored Unicode codepoints (includes definition & 10 calls) | **437** | **1,541** | **71.64% fewer** |
| Developer-authored UTF-8 bytes | **499** | **1,592** | **68.66% fewer** |
| Real Rust-compiled Node JavaScript artifact | **8,970 bytes** | Not equivalently measured | Reported separately |

The TS source includes a real reusable tokenizer, Unicode scalar comparator, frequency counting and size limits. It does not pretend that an unsafe unchecked cast is equivalent, and it has no external library. The compiled JS output SHA-256 (per-platform proof) is reported by the verifier. Compiler/run wall-times, framework/dependency bytes, general runtime memory cost and a separate `tsc` strict typecheck are **not** measured and are not claimed.

Original Git blob SHA-1 locks:
- `compact/canonical20/workloads.json`: `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`
- `compact/canonical20/cases/03-text-frequency-counter.json`: `448e77cb094d5c0ba9fb3c561de53e80407fc606`
- `compact/canonical20/programs/03-text-frequency-counter.hc`: `c8a54820def663c364ec39ee0989d1406d6370e2`
- `compact/canonical20/programs/03-text-frequency-counter.ts`: `cd42048825aa837104340bff6215441a0a97523f`

Run `npm run benchmark20:verify03`, `npm run benchmark20:status`, `npm run benchmark20:test`, `npm run m14:measure`. Only a **full runtime/typing proof with matching frozen hashes** may promote task 03 in the derived report; the source registry remains unchanged.

## Global goal and integration

This draft (#28) is stacked on draft PR #27, which is stacked on #26, #25, #24, #23, #22, #21 and their dependencies. **`main` is unchanged**. Once the *exact final head commit* passes both Ubuntu and Windows GitHub CI, the derived readiness is **4/20 verified, 0 partial, 16 unsupported** — not 70% across all twenty programs. Historical M14's **68.46% median** on its unchanged three shorter cases remains a separate result. The target `>=70%` on the eventual preregistered, fully verified 20-case median is still outstanding; no global median is available.
