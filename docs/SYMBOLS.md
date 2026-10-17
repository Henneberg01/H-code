# H-Code symbol registry - M1 snapshot

Every operation has a canonical semantic identity. ASCII is the accessible input path; symbols are optional and interchangeable notations. **User-defined glyphs are package-scoped**, not a collection of magic builtins. Reference implementations are version-locked and inspectable.

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
| 16 | ∅ | `none` | Reserved | Future Option/absence value |
| 17 | ∀ | `for` | Reserved | Future iteration |
| 18 | ∈ | `in` | Reserved | Future membership separator |
| 19 | ⊕ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::add`, two Numbers to Number |
| 20 | ▦ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::repeat2`, String to String |
| 21 | ⊙ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::is_positive`, Number to Bool |
| 22 | ⊗ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::factorial`, Number to Number |

Note: The symbols in rows 19–22 have **no language-global meaning**. These bindings are examples provided by a specifically imported, versioned demonstration library. Any permitted nonreserved symbol can represent a different operation in a different package. Two packages exporting the same glyph require explicit qualified access.

## M1 behavior

- Core ASCII/glyph spellings produce the same lexer tokens.
- After explicit package import/linking, `⊕(2,3)`, `math::add(2,3)` and `math∷⊕(2,3)` produce the same canonical linked AST when `math` imports `demo.math@1.0.0`.
- Each package manifest and `.hc` source is locked with SHA-256; mismatches cause load errors.
- Declarations include explicit parameter/return contracts and `effects: []` (no host effects exposed in the M1 reference interpreter).
- Unknown or ambiguous glyphs produce useful linkage errors rather than silently choosing an implementation.
- Core/reserved symbols cannot be redefined by packages.
- Source normalization is NFC; user glyphs additionally require NFKC stability, and invisible directional controls are prohibited.

See [`LIBRARIES.md`](./LIBRARIES.md) for runnable examples and a full authoring guide.
