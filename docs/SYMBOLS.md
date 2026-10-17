# H-Code symbol registry — primary language syntax

**H-Code uses signs as its primary real source-code syntax**, inspired by Morse-code-style compact information encoding. Each sign maps to an explicitly defined, inspectable semantic operation. A secondary ASCII spelling is always available for accessibility, keyboards, code review and AI; these are two spellings of the **same language**, not editor macros. Compactness is measured in code points and UTF-8 bytes independently. **User-defined glyphs are package-scoped**, not a collection of magic builtins. Reference implementations are version-locked and inspectable.

| # | Glyph | Alias / textual form | Status | Definition |
|---:|:---:|---|---|---|
| 1 | ƒ | `fn` | Implemented | Declare a named lexical function |
| 2 | ≔ | `let` | Implemented | Declare a mutable lexical binding |
| 3 | ↩ | `return` | Implemented | Return an expression |
| 4 | → | `->` | Implemented (parse only) | Function return type annotation separator |
| 5 | ← | `=` | Implemented | Initialize or reassign an existing binding |
| 6 | ⊤ | `true` | Implemented | Boolean true literal |
| 7 | ⊥ | `false` | Implemented | Boolean false literal |
| 8 | ∧ | `and` | Implemented | Short-circuit conjunction |
| 9 | ∨ | `or` | Implemented | Short-circuit disjunction |
| 10 | ¬ | `not` | Implemented | Boolean negation |
| 11 | ≡ | `==` | Implemented | Strict primitive equality |
| 12 | ≠ | `!=` | Implemented | Negated strict primitive equality |
| 13 | ≤ | `<=` | Implemented | Less-than-or-equal comparison |
| 14 | ≥ | `>=` | Implemented | Greater-than-or-equal comparison |
| 15 | ∷ | `::` | Implemented | Explicit qualified package-operation lookup |
| 16 | ▷ | `|>` | **CSE-1 feature branch; tests pending** | Left-to-right typed pipeline, lowers to ordinary function calls |
| 17 | ∘ | `<<` | **Symbol-composition draft branch, Rust tests pending** | Pure unary function composition; `(f ∘ g)(x)` computes `f(g(x))`, with real higher-order types |
| 18 | ∅ | `none` | Reserved | Future Option/absence value |
| 19 | ∀ | `for` | Reserved | Future iteration |
| 20 | ∈ | `in` | Reserved | Future membership separator |
| 21 | ⊕ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::add`, two Numbers to Number |
| 22 | ▦ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::repeat2`, String to String |
| 23 | ⊙ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::is_positive`, Number to Bool |
| 24 | ⊗ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::factorial`, Number to Number |

Note: The symbols in rows 21–24 have **no language-global meaning**. These bindings are examples provided by a specifically imported, versioned demonstration library. Any permitted nonreserved symbol can represent a different operation in a different package. Two packages exporting the same glyph require explicit qualified access.

## M1 behavior

- Core ASCII/glyph spellings produce the same lexer tokens.
- After explicit package import/linking, `⊕(2,3)`, `math::add(2,3)` and `math∷⊕(2,3)` produce the same canonical linked AST when `math` imports `demo.math@1.0.0`.
- Each package manifest and `.hc` source is locked with SHA-256; mismatches cause load errors.
- Declarations include explicit parameter/return contracts and `effects: []` (no host effects exposed in the M1 reference interpreter).
- Unknown or ambiguous glyphs produce useful linkage errors rather than silently choosing an implementation.
- Core/reserved symbols cannot be redefined by packages.
- Source normalization is NFC; user glyphs additionally require NFKC stability, and invisible directional controls are prohibited.

The H-Code Studio palette inserts literal Unicode characters in `.hc` source and displays the textual alias of all 15 phase-1 glyphs, plus experimental `▷` pipeline and `∘` function-composition operators. Reserved symbols `∅`, `∀`, and `∈` are **not yet executable features**. Version-locked user signs such as `⊕`, `▦`, `⊙`, and `⊗` are only available after an explicit package import, not as global builtin operations.

For real cross-compiler tests, see `phase1/fixtures/` and `prototype/test/phase1-parity.test.mjs` / `compiler/tests/phase1_parity.rs`. For source-size data, see `phase1/results/source-metrics.json`. `≡` is one Unicode code point but **three bytes** in UTF-8, more than the two bytes of `==`; never mistake fewer visible characters for guaranteed binary size or runtime speed.

See [`LIBRARIES.md`](./LIBRARIES.md) for runnable examples and a full authoring guide.

## CSE-1 feature branch — pending CI verification

The new compiler-level sign `▷` (U+25B7, stable under NFC/NFKC) has ASCII equivalent `|>`. This is a **proposed feature on a development branch**, not a stable-language feature or a released runtime guarantee.

- `x ▷ f` means `f(x)`; `x ▷ f(a,b)` means `f(x,a,b)`, with `x` evaluated exactly once.
- `x ▷ f ▷ g` means `g(f(x))`; pipelines bind more weakly than arithmetic and Boolean operators.
- A function may use `ƒ square(x) ↩ x*x;` with a required semicolon. Braced forms remain valid.
- For `(x ▷ f) + 1`, parentheses are required. Ambiguous `x ▷ f + 1` is rejected.
- The pipeline is a core token. Version-locked libraries may not reuse `▷`. User-defined `∑`, `⌕`, `⇢` remain future package-scoped operations, not core keywords.

See `docs/CSE1_STATUS.md` for current implementation and validation gates.

## Symbolic composition operator (feature branch, not released)

- Glyph: `∘` U+2218; accessible ASCII spelling: `<<`. Same token and type-checked AST.
- Semantics: `(f ∘ g)(x) = f(g(x))`. Both operands must be **unary** functions, and their return/input types must unify. The result is a first-class unary function.
- `ƒ twice(x) ↩ x*2; ƒ inc(x) ↩ x+1; print(20 ▷ (twice ∘ inc));` is expected to output `42`.
- A sign here captures a new higher-order semantic construct, **not** a shorter spelling of a JS keyword or a hidden AI instruction. It composes functions authored in H-Code, including future inspectable library functions.
- Rust checks arity and intermediate types statically. Both Rust-generated JS and the JS reference evaluate composition operands when composing them, not on each invocation.
- The compiler reserves `∘`, preventing packages from taking over the operator. No domain-specific app templates.
- Experimental implementation: `feat/cse-symbolic-composition`, stacked atop M10. JS reference checks pass; Rust and full CI remain pending.
