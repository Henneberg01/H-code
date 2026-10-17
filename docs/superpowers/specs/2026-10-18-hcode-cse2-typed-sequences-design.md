# H-Code M11 / CSE-2 — typed sequence architecture (draft)
**Date:** 2026-10-18  
**Review status:** Proposed design; NOT implemented; no M11 code is released.  
**Upstream:** PR #3 (Phase-1), draft PR #5 (M10), tracked by issue #6.

## Why this is necessary
H-Code is a new, Unicode-sign-first, **general-purpose programming language**, not a short-name JavaScript dialect, an AI prompt system, or a FastSell app builder. The honest preliminary eight-case TypeScript comparison is only **2.27%** smaller in code points at the median and **5.85% larger** in UTF-8 bytes; four cases lose to TypeScript. The long-term, independent 20-task target is ≥70% fewer **developer-authored Unicode code points**. Lists are an enabling general-purpose primitive; they do NOT independently establish that target.

The earlier CSE-2 contract mentioned typed literals, indexed reads and length, then claimed map/filter could be written in H-Code. **That is incomplete**: arbitrarily sized output lists require a safe append/builder primitive. This addendum closes that design hole openly instead of hiding domain-specific compiler handlers.

## Proposed user-facing source semantics
```hcode
≔ xs ← [1, 2, 3];
print(xs[0]);              // 1
print(xs ▷ len);           // 3
≔ ys ← xs ▷ append(4);    // returns NEW List<Number>, xs stays unchanged
ƒ empty() → List<Number> ↩ [];
≔ out: List<Number> ← []; // annotated empty list
```

```hcode
ƒ sum(xs: List<Number>) → Number {
  ≔ i ← 0;
  ≔ total ← 0;
  while (i < len(xs)) {
    total ← total + xs[i];
    i ← i + 1;
  }
  ↩ total;
}
print(sum([2,3,5])); // 10
```

```hcode
ƒ doubleEach(xs: List<Number>) → List<Number> {
  ≔ out: List<Number> ← [];
  ≔ i ← 0;
  while (i < len(xs)) {
    out ← append(out, xs[i]*2);
    i ← i+1;
  }
  ↩ out;
}
```

These are design examples, **not working H-Code programs yet**. They demonstrate that reusable sum/map logic can be expressed by the language itself. The future package-scoped `∑`, `⌕`, `⇢` operations must have inspectable, versioned implementations and must not secretly generate applications.

## Grammar (proposed)
```ebnf
type          = identifier | "List" "<" type ">" ;
list-literal  = "[" [expression ("," expression)*] "]" ;
postfix       = primary { "(" [arguments] ")" | "[" expression "]" } ;
let-decl      = ("≔"|"let") identifier [":" type] ("←"|"=") expression ";" ;
```
Whitespace is optional per normal H-Code lexical rules. The literal brackets are ordinary ASCII syntax, not symbolic packages. `List` in type position is parsed as a structured type, not a renamed JS array. Typed list expressions and indexed reads produce dedicated AST variants with original source spans. Existing `▷` / `|>` pipeline precedence remains unchanged.

## Type contracts
1. `[1,2,3]` infers `List<Number>`; `["a","b"]` infers `List<String>`; nested homogeneous lists infer `List<List<T>>`.
2. `[1,true]` is a compile-time type error. Strings and numbers do not silently coerce. Distinct list element types cannot unify.
3. `[]` has an unknown element type; require an explicitly annotated expected `List<T>` in return or binding context. Bare `≔ a ← [];` fails instead of creating `List<Any>`.
4. `xs[i]` requires `xs:List<T>` and `i:Number`. A known fractional literal fails at compile-time; ALL indexes also undergo runtime integer and bounds validation (negative/out-of-range/fractional/NaN rejected). Empty and nested lists must behave deterministically.
5. `len(List<T>) → Number` for every T. `append(List<T>, T) → List<T>` for every T. No mutation of the source list; result is a fresh list. Append and indexing evaluate arguments exactly once, left-to-right.
6. `len` and `append` are **general-purpose sequence primitives**. They use a typed intrinsic fallback in the language core until package generics are available, never opaque task-specific AI or domain macros. User-defined functions with these identifiers must retain precedence over fallback intrinsics; existing code must not silently change.
7. Existing package manifest v1 continues to allow its historical scalar contracts. The Rust checker must **not accidentally permit generic List parameters in manifest v1** merely because the language gains a List type. Manifest v2 generic contracts belong to M13.
8. Existing function inference, recursion, shadowing, package locks, Unicode control checks, source positions, exports/modules and older programs remain unchanged.

## Runtime and resource model
Both Rust-compiled JavaScript and JS reference interpreter must expose the same values, errors and observable evaluation order. The compiler emits safe helper calls, e.g. `__hc_checked_index`, `__hc_len` and `__hc_append`, not raw unguarded array access. Preserve instruction-fuel/depth budgets, add list allocation limits, and reject unknown host privileges. Append may be O(n) initially; explicitly measure this and leave algorithmic optimization to M28/M38. The generated JS is still **NOT a sandbox**.

## Required negative and positive conformance
- Success: scalar and nested literals, inferred and explicit list types, empty return/binding, integer indexing, len, append, pipeline into len/append, user-written sum and variable-length map, glyph/ASCII equivalence.
- Failure: heterogeneous literal; non-list indexing; string index; fractional/negative/out-of-bounds index; inferred bare `[]`; wrong append element; append non-list; overriding package manifest v1 with generic contracts; use of hidden/invisible Unicode characters.
- Error diagnostics must contain source span and stable error categories. The JS reference is not a complete static analyzer today; Rust owns the compile-time gate and reference must match runtime errors.

## Test/benchmark policy
At least twelve committed paired Unicode/ASCII fixtures plus negative test vectors, including package-lock compatibility and M0–M10 regression suites. Run actual compiled H-Code vs idiomatic TypeScript; report code points, UTF-8 bytes, generated JS and dependency sources separately. Include worse-performing cases; publish no 70% or speedup claims without the full canonical 20-task study.

**Implementation gate:** Begin M11 compiler work only once M10 has a verified Rust/Node test run and Phase-1 lineage is reviewed. No merge, release or automatic paid CI is authorized by this design.
