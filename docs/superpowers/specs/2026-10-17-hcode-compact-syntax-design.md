# H-Code Compact Syntax Engine — architectural design

**Date:** 2026-10-17
**State:** design for owner review; NOT an implemented feature
**Project:** H-Code, a standalone, Morse-inspired, Unicode-sign-first, general-purpose programming language
**Rights:** Copyright © 2026 Jonas Fogh Henneberg, operating as Fastsell.net (CVR 46614887), Denmark
**Source license:** Apache-2.0; official H-Code branding separately governed by TRADEMARKS.md

## 1. Agreed purpose

Make the **source code an H-Code developer actually authors** dramatically more compact without reducing expressive power, correctness, debuggability or inspectability. The research objective is **70% fewer Unicode code points** on representative, equivalent working programs compared with idiomatic TypeScript. This target is **not established** and is not a guarantee across all programs, nor proof of lower runtime cost. The user confirmed that developer-authored source is the **primary** metric and total delivered size (including libraries/dependencies) is a separate, mandatory report.

H-Code signs must be **real grammar/compiler tokens**, not glyph abbreviations inserted only by a UI, JavaScript search-and-replace tricks, a hidden prompt, or an uninspectable list of magic webshop/game operations. The system must remain useful for **arbitrary general-purpose software**. Text aliases stay as accessible, semantically equivalent spellings. AI must remain optional.

### Existing, observed implementation

- JavaScript reference interpreter: `prototype/src/hcode.mjs`.
- Rust source lexer/parser/typechecker/emitter: `compiler/src/{lexer,parser,checker,ast,codegen}.rs`.
- Current syntax supports symbols/aliases for 15 core token kinds, functions, assignments, numeric/string/bool expressions, control flow, function calls, and explicitly imported SHA-locked symbol libraries.
- Rust already infers types of some unannotated functions and variables, but its Type representation currently covers scalar/function types only; there are **no List or record expression types**.
- Current functions require brace-delimited bodies; expression statements require semicolons. `▷`, `|>`, list literals, property selectors, higher-order collection transforms and record literals are not supported yet.
- Phase-1 hardening source is on `feat/phase1-symbol-conformance` in draft PR #3, not merged into `main` as of the design read. Four small measured symbol/alias pairs had **11.39–18.92% fewer code points**, **0–5.88% fewer UTF-8 bytes**. This is an **alias-vs-glyph** study, not a TypeScript comparison.
- H-Code-generated JavaScript executes with ordinary Node privileges; it is **not sandboxed**.

The compact engine is a **post-phase-1** project. It must not overwrite, silently merge, or falsely mark PR #3 released.

## 2. Architectures considered

### A. Shorten keywords and punctuation only

Add short aliases, optional semicolons and shorthand functions. Low implementation cost and easy compatibility. Cannot plausibly create a broad 70% decrease because it leaves the amount of required algorithmic code unchanged. **Not chosen alone.**

### B. Symbol-first compiler syntax plus typed, inspectable operations (**chosen**)

Add small, unambiguous compiler-level combinators and a versioned collection library. Typed reusable operations do real work, are openly defined, and are composable. Build a matched-program benchmark harness with transparent dependency accounting. This is the smallest approach with a plausible path to high source reduction while remaining a real general-purpose language. Costs: new AST/type rules, generic List/record support and rigorous compatibility tests.

### C. AI macros or built-in application templates

One sign produces an entire webshop/API/game scene from a hidden preset, or AI writes the missing code. May appear 90% shorter, but hides complexity and undermines source determinism, inspectable meaning, cost fairness, and the universal-language requirement. **Rejected** as the measure of compactness. Optional libraries can still be large; their size must be disclosed.

## 3. Architectural principles and stage boundaries

H-Code follows a **small syntax core** and a **rich, versioned, typed library ecosystem**:

1. **CSE-1: compact expressions and pipelines (first implementation unit).** Add a single-expression function declaration plus a native pipeline operator. Use existing Type/Function and Call AST/typed semantics where possible. Do not add or rename the existing core 15 signs, change package formats, or add new builtins.
2. **CSE-2: symbol-first typed sequences.** Proposed primary source signs: `⟦...⟧` for typed sequence values, `xs⟦i⟧` for bounds-checked indexed access, `⌗xs` for length and `xs ⧺ ys` for pure typed concatenation. Implement with a real AST/static checker. Internal type nodes may use List<T> nomenclature but developer-facing syntax is signs. Implement consistently in reference interpreter and Rust compiler; keep output deterministic.
3. **CSE-3: records and reusable collection operators.** Introduce record types/field access, simple typed function selectors, and a SHA-locked **hcode.collections@1.0.0** pure library. Define map/filter/sum as discoverable operations with explicit contracts; extend library manifest format versionfully for generic contracts rather than breaking existing package v1.
4. **CSE-4: representative measurements and developer ergonomics.** Build 20 matched real tasks, provenance/CI reports and Editor/Language Server support when available. Publish outcomes whether or not 70% is reached. Optimize only proven bottlenecks; don't fabricate execution speedup.

Each unit requires its own implementation plan, focused pull request, behavior tests and full regression suite before the next begins. The present design governs the overall direction; the **first actionable plan is CSE-1 only**. CSE-2/3 are successive architectural expansions with their own boundary reviews.

## 4. CSE-1 exact grammar and semantics

### 4.1 Short expression-return function

Existing:

```hcode
ƒ double(x: Number) → Number {
  ↩ x * 2;
}
```

New (proposed, not yet supported):

```hcode
ƒ double(x: Number) → Number ↩ x * 2;
```

Both parse to the **same Function node with one Return statement**; source locations may differ but type checking, output and errors must be equivalent. The new syntax accepts `return` as an alias of `↩`. It requires the trailing semicolon in CSE-1; no global semicolon-insertion rule. Function parameter/return annotations remain optional where the existing Rust inferencer can correctly infer them.

Formal shape:

```ebnf
function-decl := ("ƒ" | "fn") identifier "(" params? ")" return-type? function-body
return-type   := ("→" | "->") identifier
function-body := block | ("↩" | "return") expression ";"
```

The new body form is only valid **immediately after a function signature**. A lone `↩` at top level retains its existing diagnostic. Exported functions use the same rule. Recursion and shadowing behavior are unchanged.

### 4.2 Pipeline expression

New Unicode **`▷`** (U+25B7), ASCII alias **`|>`**, both NFC/NFKC stable and mapped by each real lexer to the same **Pipe token kind**. The glyph is added as a compiler-level operator only after compatibility checks and documented as a newly reserved core glyph. Existing future package use of `▷` must be scanned beforehand; collision requires a migration note, not silent override.

```hcode
ƒ double(x) ↩ x * 2;
≔ answer ← 21 ▷ double;
print(answer);
```

Accessible equivalent:

```hcode
fn double(x) return x * 2;
let answer = 21 |> double;
print(answer);
```

Both must print `42`.

**Semantics:**

- `left ▷ f` is semantically equivalent to `f(left)`.
- `left ▷ f(a,b)` is `f(left,a,b)`; left expression is **evaluated exactly once**.
- `left ▷ f ▷ g` is `g(f(left))`, **left-to-right associative**.
- A pipeline binds **less tightly than all existing boolean/arithmetic operators**, and more tightly than any future assignment expression (current assignment is only a statement). `1 + 2 ▷ f` means `f(1+2)`; `a ▷ f + b` is a parse/type error rather than silently ambiguous until this pattern has a documented grammar.
- The right side is a callable identifier, qualified operation, glyph package operation, or explicit call expression. No implicit lambda syntax in CSE-1.
- Only typed callable operands accepted; a non-function, wrong parameter count, or unsupported effect is a compile-time error with source location.
- Pipeline lowering uses compiler AST into the **existing checked Call representation** rather than string-substituting JavaScript. If lowering creates temporary nodes, preserve input evaluation order, spans and diagnostic provenance.
- No new runtime privilege, hidden import, I/O or AI call. Both frontends accept/reject matching cases and produce equivalent outputs.

### 4.3 Package operation example

```hcode
use "demo.math@1.0.0" as math;
≔ answer ← 20 ▷ math∷⊕(22);
print(answer);
```

This means the **locked** `demo.math@1.0.0::add(20,22)`, not an unqualified arbitrary global built-in. Resolve ambiguity and effects exactly as today.

## 5. CSE-2 symbolic sequence contract (next independent unit)

**Normative 2026-10-18 correction:** H-Code remains a sign-first language. Primary proposed syntax is `⟦1,2,3⟧`, `xs⟦i⟧`, `⌗xs`, `xs ⧺ ys`, and `⟦Number⟧` in explicit type positions. Internal compiler types may use conventional names, but source language cannot default to `List<T>`, `len` or `append` as primary examples. See `docs/superpowers/specs/2026-10-18-hcode-cse2-typed-sequences-design.md`.

The operator `⧺` provides a pure, general-purpose way to build variable-length typed sequences by composing with singleton sequences, without a hardcoded app builder. `∑`, `⌕`, and `⇢` require a separately checked general operator-binding scheme in CSE-3: they are not implemented or globally reserved by this design. All sign semantics must be inspectable, typed and compatible with existing locked packages. Existing Rust/JS conformance and execution tests must pass before promoting this from design to compiler capability.

## 6. CSE-3 records and package-defined operators (future, independently reviewed)

The planned package exports **`∑`** (typed sum of `List<Number>`), **`⌕`** (filter with predicate) and **`⇢`** (map with transformer). All three are stable Unicode symbol code points and are **package-scoped**, not automatically imported global keywords. No core reservation is made merely by this document. Type signatures:

```
sum(List<Number>) -> Number
filter<T>(List<T>, (T)->Bool) -> List<T>
map<T,U>(List<T>, (T)->U) -> List<U>
```

These generic signatures are **future manifest v2 contracts** and cannot be interpreted by the present package manifest v1. Future typed record selectors `.field` and truthy predicate shorthand `?field` must only be accepted if the field exists and has a known type (Bool for predicate).

Conceptual goal (NOT currently executable, dependent on CSE-2/3):

```hcode
use "hcode.collections@1.0.0" as c;
record Order { paid: Bool, amount: Number }
ƒ total(os: ⟦Order⟧) ↩ ∑(os ⌕ isPaid ⇢ amount);
```

In the proposed sign syntax, `isPaid` and `amount` are ordinary user-authored typed H-Code functions; `⌕` filters by the former, `⇢` transforms via the latter, and `∑` sums the resulting typed numbers. This is conceptual until records, generic infix operator binding and locked collection contracts are implemented. It must not be accepted before record/selectors/contracts are implemented. Do not reuse `?` or `.` for unrelated purposes without a compatibility review.

## 7. Correctness, diagnostics and protection

- Preserve all existing `.hc` samples, import/export, lockfile SHA-256, version resolution, the 15 existing core signs and basic errors. Unknown Unicode, normalization changes, bidi/invisible controls, ambiguous package glyphs and unauthorized effects fail closed.
- Provide source-located parser errors when pipeline RHS is not callable, cannot be parsed unambiguously, or creates type/arity mismatch. Do not replace a useful error with emitted JavaScript runtime failure.
- Dual frontend conformance: for every new syntax form, create matched glyph/ASCII fixtures, negative syntax/type cases and actual Rust-compiled JS execution tests; compare with the JS reference interpreter.
- Avoid escalating privileges: current generated JS remains unsandboxed. Prohibit claims that compact syntax offers process isolation or inherently faster CPU execution.
- No forced public release, auto-merge, automatic paid CI, publishing of API keys or changes to main during feature development.

## 8. Measurement: 70% primary target and separate size accounting

### Primary metric

**Unicode code-point reduction in developer-authored source**:

`reduction = 100 × (1 - HCode_source_codepoints / idiomatic_TypeScript_source_codepoints)`.

Count all handwritten file content including necessary imports, configuration written by the developer, tests if part of the compared implementation, and H-Code package definitions when custom-built **specifically** for the task. Measure ordinary working source, not minified/obfuscated code. Normalize line endings to LF; apply the same comment/formatting policy on both sides (include idiomatic explanatory comments as applicable, report significant/blank lines independently). A one-time lockfile generated mechanically may be excluded from handwritten source on **both** sides, but must be counted in the separate total-size/dependency metric.

### Mandatory additional metrics

- Source UTF-8 bytes.
- Whole package size incl. imports/lockfiles and in-repo dependency source; distinguish installed dependency directory size and final deployed artifact.
- Generated JavaScript/output artifact size where relevant.
- Runtime wall-clock/CPU, memory, cold and warm compilation metrics separately — with machine specs, repetitions, distribution, and equivalent I/O.
- Developer task completion time (human study only) and AI model input/output token usage (pinned tokenizer/model and matched prompts only). If unmeasured, explicitly say `not measured`, never zero.
- Correctness parity and actual backend support.

### Representative 20-workload program set

Use the 20-workload inventory already in `docs/BENCHMARKS.md`: calculator, recursion, text frequency, CSV, JSON, HTTP client, file conversion, async aggregation, TTL cache, generic transforms, Markdown, CRUD API, form UI, todo app, database dashboard, auth sessions, WebSocket chat, refactoring, bug fix and feature extension. All are in scope for the **long-term universal-language benchmark**, but most are currently **unsupported** and must not be presented as completed results.

For **CSE-1** add a smaller, preregistered 6-pair capability set focusing on existing supported arithmetic, recursion, functions and locked symbol operations to validate the language change before general-purpose support exists. Do not select only winners. Build the official 20-program comparison later, preserving task specs and a separately reviewed idiomatic TypeScript baseline. No 70% overall claim until all 20 matched workloads run, correctness passes, and the complete per-task distribution (including misses) is published. Target: **≥70% median code-point reduction** over all 20 *fully supported* equivalent workloads; explicitly report mean, worst cases and supported coverage. If any selected workload is unsupported, the 20-task target is **not met**, rather than omitting that row.

### Baseline caveat

The 2026-10-17 four-fixture 11–19% comparison was **glyph vs H-Code aliases**, **not** H-Code vs TypeScript; it must not be marketed as proof of H-Code vs other languages.

## 9. First release unit: CSE-1 acceptance tests

Implement only after review/approval of this spec **and** a separately reviewed executable implementation plan.

- Add token kind `Pipe` for `▷` and `|>` in both frontends. Scan existing versioned signs for collision before reserving it.
- Add expression-return function form to both parsers, canonical AST parity with brace form, exported-function behavior and required trailing `;`.
- Add pipeline parsing/lowering and checker validation for `value ▷ function`, `value ▷ function(a)`, `value ▷ package∷glyph(a)`, nested/associative cases, arithmetic/Boolean precedence and evaluation exactly once.
- Minimum six **fresh** glyph/ASCII program pairs and at least six negative cases, each tested through JS reference and Rust typecheck+codegen; preserve all existing 107 local baseline tests (baseline to be freshly re-run).
- Establish baseline comparisons from honest, documented TypeScript equivalents, recording direct source size and byte size. No 70% marketing claim.
- Maintain H-Code Studio glyph palette and alias descriptions for new implemented **core** glyph only when semantic support lands.
- Record tests, failures, version/branch SHAs, measurement output and project decisions; submit draft PR to existing repository without merge/deploy. Note `main` and phase-1 PR #3 can move independently.

## 10. Scope exclusions and sequencing

CSE-1 explicitly excludes lists, records, lambdas, generic manifest contracts, HTTP/I/O, game/commerce templates, global semicolon insertion, optimizer IR (reserved for M21), packaging/registry/cloud and binary/wire-size compression. These are planned or future units, not implementation shortcuts.

Prefer implementing CSE-1 on a new branch **derived from the latest reviewed phase-1 feature branch** while PR #3 remains unmerged; do not silently depend on a stale main. A separate review decides if and when to merge into main. This is a source language evolution, not a FastSell platform change.

## 11. Explicit owner decisions recorded

- **Use actual signs** inspired by Morse/SOS information density.
- Preserve typed, inspectable symbol and ASCII dual spelling; no hidden AI encoding.
- Pursue 70% reduction as a research target.
- **Primary measure = developer-authored code**, while **whole program plus dependencies = mandatory separate measure**.
- Developer approved the above *product direction* in conversation. The exact new grammar and scope of CSE-1 in this document still need review before implementation planning.
