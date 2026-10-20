# ∃ — typed existential search in JFH-CODE

`values∃predicate` evaluates to `Bool`: true if at least one element satisfies
the predicate, otherwise false. An empty typed sequence returns false.
The ASCII spelling is `values @! predicate`; it has identical semantics.

```hcode
≔values←⟦3,-2,7⟧
⊨(values∃(<0))
≔users←⟦⦃name:"Ada",active:⊥⦄,⦃name:"Bo",active:⊤⦄⟧
⊨(users∃λuser:user·active)
```

This is a native language operation: both lexers recognize the actual sign,
the parser builds a binary operation, and Rust checks
`Sequence<T> × (T → Bool) → Bool`. Contextual lambdas, named functions,
operator sections and function composition work with ordinary typed data.
Wrong sequence types, callback types/arity and non-Boolean results are errors.
The input element type must be known before checking the predicate. Annotate an
empty sequence explicitly, for example `≔empty:⟦Number⟧←⟦⟧`; the predicate alone
does not supply an empty input's element type in this implementation. Both
frontends and the pure-package checker enforce this rule.

Both operands are evaluated once, in order. Elements are examined from left
to right, with one fuel step per visited element. Search returns immediately
on the first true result and creates no filtered output sequence. Tests verify
that a matching second element visits only two elements and that a predicate
factory runs once. This is a semantic property, not a runtime speed benchmark.

Precedence matches `⌕` and `⇢`. Parenthesize the whole search when negating it:
`¬(values∃predicate)`. The sign is reserved against package overrides.
Normal callback effects follow the existing collection rules; CAS and
WebSocket reducers retain their effect restrictions, including named helpers.
Verified pure packages check existential callback and return types before use.
`∀` retains its existing role as a generic type binder.

The emitted runtime helper is included only when the checked program or an
imported package uses this operation. Existing programs retain their prior
generated code. The reference interpreter independently evaluates the AST;
Studio inserts the literal `∃` sign with its accessible alias.

## Working JFH-CODE app, same behavior

The frozen original [todo source](../compact/canonical20/programs/14-todo-app.hc)
is preserved. The [new JFH-CODE variant](../compact/canonical20/candidates/14-todo-exists.hc)
replaces four “filter then count” searches with `∃`, including title validation,
duplicate checking, and missing-item checks. No app-specific operation was
added to the compiler.

| Whole developer-authored JFH-CODE file | Original | New |
| --- | ---: | ---: |
| Unicode code points | 1456 | 1442 |
| UTF-8 bytes | 1757 | 1733 |

That is **0.96% fewer code points** and **1.37% fewer UTF-8 bytes** for this
complete app. It is a small language improvement, not proof of the global 70%
goal. Four temporary filtered sequences are replaced by short-circuit searches.
Generated runtime size is separate from authored source.
The actual generated app grows from **22,392 to 22,637 bytes** because it adds
the reusable search helper. [Machine-readable measurements](../compact/results/sequence-exists.json)
record the source and generated-code hashes separately.

Source Git blobs: original `2931b75caac9db0582e0d8088fe2f1e29f5cd934`,
variant `4f45148c6e208b31fcc995983754910f0ef0b026`.
The app proof compiles both JFH-CODE files with Rust and compares all fifteen
unchanged browser-probe stages over three separate Chromium launches per app.
It checks actual persisted state, duplicate rejection and inert hostile text.
The independent interpreter also exercises the new app's validation,
duplicate and missing-item behavior.

Run in the prepared cloud:

```sh
. /workspace/.hcode-environment/activate.sh
cargo test --manifest-path compiler/Cargo.toml --test sequence_exists
node --test prototype/test/sequence-exists.test.mjs scripts/sequence-exists-proof.test.mjs
cargo run --manifest-path compiler/Cargo.toml -- run examples/sequence_exists.hc
```

This remains development-branch functionality. The original benchmark registry,
fixtures and historical measurements are unchanged. Work continues toward more
expressive, reusable, typed JFH-CODE signs and shorter working programs.

Final local validation: **239 Rust tests, 190 reference tests, 17 Studio tests,
13 focused language/browser tests, and all twenty original acceptance workloads
passed**. The example ran successfully with both engines. Independent review
checked the explicit empty-input type rule and callback effects. The browser
driver now waits for the actual page target when Chromium opens its debug port
before creating that page; a failing-then-passing discovery regression covers
this startup race under the existing deadline. Release and whitespace checks
also passed. Remote CI results are separate from these local results.
