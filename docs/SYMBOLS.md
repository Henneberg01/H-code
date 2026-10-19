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
| 18 | ◇ | `?` | **Choice feature branch, Rust tests pending** | Lazy, typed conditional expression; `condition ◇ yes : no` selects exactly one branch |
| 19 | ⟦ | `[[` | **CSE-2 experimental branch** | Begin a typed sequence or safe element-index operation |
| 20 | ⟧ | `]]` | **CSE-2 experimental branch** | Close a typed sequence or index |
| 21 | ⌗ | `#` | **CSE-2 experimental branch** | Pure sequence length, checked in both frontends |
| 22 | ⧺ | `++` | **CSE-2 experimental branch** | Pure, typed, capacity-limited sequence concatenation |
| 23 | ∑ | `@+` | **M13 core prototype; Rust tests pending** | Reduce any numeric sequence to its sum, including an empty one |
| 24 | ⌕ | `@?` | **M13 core prototype; Rust tests pending** | Stable typed filtering by a unary H-Code predicate returning Bool |
| 25 | ⇢ | `@>` | **M13 core prototype; Rust tests pending** | Stable generic transformation by a unary H-Code function, type-changing allowed |
| 26 | λ | `lambda` | **M14 development branch; Rust tests pending** | Lexically scoped, first-class, typed unary H-Code function expression |
| 27 | ⊢ | `if` | **M15 branch; CI pending** | Boolean guard for one of two control branches |
| 28 | ⊣ | `else` | **M15 branch; CI pending** | Lazy alternative branch, nearest preceding unmatched if |
| 29 | ⟳ | `while` | **M15 branch; CI pending** | Repeating Boolean-guarded statement/block |
| 30 | ⇒ | `=>` | **M15 branch; CI pending** | Delimit exactly one statement as a scope-preserving control block |
| 31 | ∅ | `none` | Reserved | Future Option/absence value |
| 32 | ∀ | `forall` | **M16.2 rank-1 generic binder (draft)** | Rigid universal type variable binding on SHA-verified pure functions |
| 33 | ∈ | `in` | Reserved | Future membership separator |
| 34 | ⊕ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::add`, two Numbers to Number |
| 35 | ▦ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::repeat2`, String to String |
| 36 | ⊙ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::is_positive`, Number to Bool |
| 37 | ⊗ | `packageAlias::operation` | **Demo package** | `demo.math@1.0.0::factorial`, Number to Number |

Note: The symbols in rows 34–37 have **no language-global meaning**. These bindings are examples provided by a specifically imported, versioned demonstration library. Any permitted nonreserved symbol can represent a different operation in a different package. Two packages exporting the same glyph require explicit qualified access.

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

## Symbolic conditional choice — experimental, NOT released

The core sign `◇` is an actual **lazy expression construct** with secondary ASCII alias `?`; colon separates alternatives. Example:
```hcode
ƒ fib(n) ↩ n≤1 ◇ n : fib(n-1)+fib(n-2);
print(fib(7));
```
`◇` is **not** a textual replacement for `if`: it introduces an expression AST node with a Boolean-only condition, unification of both arm types, strict evaluation of the condition exactly once, and **lazy** evaluation of exactly one arm. Rust emits a JavaScript conditional expression and the reference interpreter uses the same lazy behavior. Nested choices are right-associative. It is weaker than arithmetic, Boolean operators, `∘`, and `▷`. The type checker must reject incompatible arms and non-Boolean conditions. The ASCII `?` spelling is secondary and is contextual; future prefix selectors must not change its existing infix semantics.

Three new source versions are kept separate under `compact/benchmarks/symbol-choice/`. They are compared **only** against the corresponding original three M10 frozen H-Code sources and existing TypeScript files, preserving task IDs, inputs and expected output. See `docs/SYMBOL-CHOICE.md`. Do **not** recalculate the historic eight-case median by silently overwriting its inputs.

**Status:** JS-reference semantic probes passed on development branch; authored Rust test suite requires real Cargo execution before merge.

## CSE-2 symbolic sequences — experimental, not yet released

The primary source forms are `⟦1,2,3⟧`, `xs⟦0⟧`, `⌗xs`, and `xs ⧺ ⟦4⟧`; explicit type annotations are `⟦Number⟧`, recursively nestable. Accessible ASCII alternates are `[[1,2,3]]`, `xs[[0]]`, `#xs`, and `xs ++ [[4]]`. The source sign is the language; ASCII versions are accessibility alternatives.

The implementation has distinct Rust AST and typechecker variants, with homogeneous-element inference, checked index type/bounds and immutable concatenation. Typed empty sequences require context, e.g. `≔ xs:⟦Number⟧ ← ⟦⟧;`. Runtime length/allocation is bounded; sequence operation side effects are not exposed. The JavaScript reference has runtime annotation checks; Rust is the authoritative static checker.

**Status:** implemented on isolated `feat/m11-symbol-sequences-spike` with reference checks, not compiled or released. See `docs/CSE2_IMPLEMENTATION.md` for limits and verification gates. `⌕`, `⇢`, `∑` remain future **separate**, typed general-purpose signs, not built-in shortcuts or implemented syntax.

## M13 core collection signs — implemented in feature branch, unreleased

`∑`, `⌕` and `⇢` are **real compiler operators**, not textual replacements for TypeScript calls.

- `∑xs` requires `xs:⟦Number⟧`, returns Number, sums left-to-right, and returns `0` for an empty number sequence. ASCII fallback `@+`.
- `xs ⌕ pred` takes `xs:⟦T⟧` and a **unary H-Code function** `pred:T→Bool`; returns `⟦T⟧`, preserving order. ASCII fallback `@?`.
- `xs ⇢ f` takes `xs:⟦T⟧` and unary `f:T→U`; returns `⟦U⟧` even when the element type changes. ASCII fallback `@>`.
- `⌕` and `⇢` bind with the same precedence as `⧺`, process left-to-right, and require parentheses when indexing the *result* of an expression: `(xs⇢f)⟦0⟧`. Prefix `∑` binds tightly, so combine signs as `∑(xs⌕pred⇢f)`.
- No hidden AI, no external host access, no per-task hardcoding. Resource accounting ticks once per element; sequence sizes are bounded to 16,384 in the current prototype. H-Code compiler typechecks callable arity and types.
- Rust, JS reference and Studio changes have been authored; **Rust/Cargo and complete CI have not yet been executed**. The sign operators are not in `main`.
- These are **core primitives**, not a claim that M13's larger generic package-manifest-v2/user-defined operator work is finished.

See `docs/M13-COLLECTION-SIGNS.md` and the locked, same-task `compact/benchmarks/m13/` comparison.

## M14 — `λ` functions and first-class operator sections (draft)

Unicode-first H-Code supports `λx:x*2`, `λx:x>0` and general unary **operator sections** such as `(*2)`, `(>0)`, `(≤3)`, `(+2)`, `(≡"x")`. These are typed function **values**, not textual replacements for built-in TypeScript functions.

`λx:body` is an expression that captures lexical H-Code scope and takes one argument `x`; its type is inferred from the body and its use site. ASCII fallback `lambda x:body` is an accessibility alternative. Anonymous identity with unconstrained type is rejected by Rust until context can fix the type; typed callbacks work in `⌕`, `⇢`, `∘` and regular calls.

The expression `(*2)` creates a reusable unary function `Number→Number` which multiplies **its input** by 2. `(>0)` has `Number→Bool` type; `(+2)` supports Number or String with the usual H-Code `+` typing. The right-hand argument is evaluated exactly **once** when the section value is created, including when it has side effects; each future invocation uses the captured value. Equality operators operate only on comparable primitive types. Ordinary negative constants `(-2)` retain their existing meaning. These definitions are generic, typechecked and have no AI or application-specific shortcuts.

```hcode
≔ ys←⟦10,11⟧⇢(*2);
print(ys⟦0⟧);
print(ys⟦1⟧);
```

Expected `20`, `22`.

Nested/combined applications: `∑(⟦-1,2,3,-2⟧⌕(>0)⇢(*2))` returns `10`. `⌕`, `⇢`, `∑` remain independent, general M13 core operators.

**Status:** on `feat/m14-typed-lambda-glyph`, authored Rust AST/typechecker/backend plus tested JS reference. **Cargo/complete CI not yet run**, `main` unchanged. Full semantics and independent matched-task benchmark in `docs/M14-SYMBOL-LAMBDAS.md`.

## M15 — real control glyphs and delimiter elision

The primary characters are `⊢` (`if`), `⊣` (`else`), `⟳` (`while`) and `⇒` (`=>`) for a **single-statement** branch/loop body. A semicolon is optional only at a real physical line break after a complete expression, a block/file end or before a reserved statement-opening token. Same-line adjacent ordinary function calls still require a separator. Compiler and reference interpreter implement identical AST scoping and branch behavior; see `docs/M15-SIGN-BLOCKS.md`. Draft branch, not released.

## M16 — brugerdefinerede tegn i låste pakker

Ikke-reserverede Unicode-symboler som `⊚` (typet sum) og `⊛` (typet transform) kan defineres i et **format v2** bibliotek som eksisterende H-Code-funktioner og bruges via `vec∷⊚(⟦2,3,5⟧)`. Der tilføjes ingen hardcodet betydning for `⊚` eller `⊛` til Rust lexerens kernetokens. Brugeren ejer betydningen i det eksakte versionslåste `.hc` bibliotek. Et manglende, tvetydigt eller reserveret tegn afvises. Se `docs/M16-USER-SIGNS.md`. `main` er ikke ændret.

## M16.2 — `∀` er nu en rigtig typedeklaration

`∀T ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧` deklarerer et **rigidly quantified** `T`, ikke fremtidig iteration. ASCII-tilgængelighed: `forall`. Format-3-biblioteker kan låse brugerens egne glyphs `⥇` / `⥈` til genbrugelig H-Code-kilde. Tegnene får frisk typeløsning ved **hvert kald**; der bruges ikke `Any` eller skjult JS/AI. Se `docs/M16-2-UNIVERSAL-SIGNS.md`. Kernen er endnu kun på draft-branch.

## M12/CSE-3a — ⦃records⦄, ·felter og ⊞ immutable opdatering (draft)

- `⦃a:1,b:"text"⦄` konstruerer en almindelig, eksplicit typet record; ASCII-alias `{a:1,b:"text"}`.
- `record·a` læser et kendt felt. ASCII-alias `record.a`. Ukendte felter og forkert type er **statiske Rust-fejl**.
- `record⊞a:value` opretter en uforanderlig kopi, hvor et eksisterende felt ændres. Det **erstatter** den længere, reelle JS/TS-konstruktion `{...record,a:value}`. ASCII-alias `record<+a:value`.
- Typeannoteringer `⦃a:Number,b:⦃name:String⦄⦄` er præcise strukturelle typer; nesting, typed sequence and function calls understøttes.
- Et record lagres som et frosset null-prototype-objekt i både referenceruntime og Rust-emitteret JS. Ingen implicit `constructor`/`__proto__`-adgang.
- Denne milestone giver ikke i sig selv JSON, DB, HTTP eller et komplet CRUD API. 20-programmers benchmark forbliver separat og ufuldstændigt.

Se `docs/M12-SYMBOLIC-RECORDS.md` for kildefaste Rust/JS/TS-paritetstests, typeregel, negative tests og ærlige tegn/byte-målinger. PR er stacked på M19 og **ikke merged til main**.

## M19.03 — generelle Unicode- og frekvenstegn (draft PR)

- `⫶text` (`text_scalars`): Unicode-kodepunkter, ikke UTF-16-halvdele; `String → ⟦String⟧`.
- `⟟text` (`text_words`): normaliser til NFC, Unicode-lowercase, NFC; hent Unicode-ord med `[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}\\p{Pc}]*`. Ingen locale-baseret sortering eller påstand om fuld ICU/casefold.
- `⧉list` (`text_hist`): frekvensmap over eksakte, statisk typede `⟦String⟧`, `⟦Number⟧`, `⟦Bool⟧`, resultat `⟦⦃count:Number,value:T⦄⟧`; deterministisk sorteret efter kodepunkter/tal/`false`-før-`true`.
- Det er reelle AST- og checkeroperationer i Rust og JS, ikke tekstmakroer til opgave 03. Eksempel: `ƒ frequency(s:String)→String ↩ ⤒(⧉(⟟s));`.
- 1 MiB input / histogram-stringbudget, 16.384 sekvenselementer, uparrede UTF-16-surrogater afvises. Records er immutable og prototypefrie. Core-symboler er reserveret, kan ikke skygge verificerede brugerpakker.
- Original M19 benchmarkregistrering for opgave `03-text-frequency-counter` er SHA-frossen og skal forblive uændret. Se `compact/canonical20/PROOF-03.md` for fuldt bevis og begrænsninger, når CI består.


## M19.04 — `⧄` filadgang og `⧇` typed CSV (draft #29)

Tegnene er kernesyntaks i Rust AST/typecheck/emitter og JS-reference; ikke genveje til benchmark-output. `⧄path` (`file_read`) er en eksplicit String-filadgang, der er afvist som standard og kræver `HCODE_ALLOW_FILE_READ=1` i Node. Kun projektets `data/` og højst 1 MiB er tilladt; traversal, symlinks og unsafe paths afvises. Pure verificerede biblioteker må ikke bruge fil-effekten. Ekstra OS-sandbox er nødvendig, hvis filsystemet kan ændres af angribere.

`⧇⦃age:Number,active:Bool,name:String⦄csvText` (`csv_typed`) parser RFC4180-lignende citeret tekst til en immutable typekontrolleret `⟦Record⟧` med nøjagtige headers, escaped quotes, embedded newlines, BOM/CRLF, endelige Number og lowercase Bool. Den er ren og tilgængelig uden `⧄`-filadgang. Se `compact/canonical20/PROOF-04.md` og `npm run benchmark20:verify04`.

## M19.01 — `⌨` and `⩚` for an actual calculator CLI (PR #33)

These are real, reserved core-language signs, not textual replacements for JS or a canned calculator app. `⌨` (`stdin_text`) is a one-time String read from host stdin with 64 KiB UTF-8 limit and a static effect ban inside pure signed packages. `⩚` (`arith_eval`) accepts String, statically returns finite Number and implements a reusable precedence/parenthesis/unary arithmetic parser without interpreting the data as executable JS. Invalid arithmetic (including division by zero) produces a deterministic stderr line and process exit code 2; valid input produces a single numeric stdout line and exit code 0. Both Rust emitter and independent H-Code JS interpreter implement it separately; see `compact/canonical20/PROOF-01.md`. The original registered task 01 and its JS/TS/HC SHA-frozen inputs remain unchanged; the overall 20-task median is still unproven.

## M19 sign-first H-Code: core stable descending sort and controlled output (merged)

- **↧** (secondary accessibility form `@v`): a native AST expression over a typed sequence and a unary numeric-key H-Code function, `⟦T⟧ × (T→Number) → ⟦T⟧`. Sorts descending, stable on equal keys, non-mutating, numeric key evaluated once per input, finite Number required. Example: `xs↧λx:x·score`. It is **not** shorthand for TypeScript `sort()`, nor a business-domain-specific macro; it has real native Rust type inference and an independent H-Code JS evaluator.
- **⎙** (secondary accessibility form `print`): the compiler-owned effectful output operation, one native visible source sign. Example: `⎙(⤒xs)`. Denied inside pure signed packages; existing ASCII `print` programs remain backward compatible.

Studio's sign palette inserts the actual glyphs, with accessible alternate spelling labels. These features are in a development PR and do **not** constitute proof of the ≥70% overall source-length reduction.

### M19 sort-key effect isolation (candidate)

The `↧` key function must be statically known and effect-free. Rust traverses
key selectors, including transitive named H-Code function calls, before
emitting ESM and rejects print/DOM/storage/file/database/network or mutable
capture access. The independent H-Code interpreter also activates its
runtime purity boundary when evaluating keys, before host effects can run.
Compiled ESM uses the same effect isolation with a protected, restored guard
for every key, including exceptions. This is a language-wide semantic rule,
not a dashboard-specific condition.

For clarity: `↧` sorts the original sequence **without mutation**;
it computes each numeric key once, maintains source order on ties and rejects
non-finite numbers. The new effect-isolation safeguards do not change output
on pure selectors and do not modify the SHA-locked comparison corpus.
