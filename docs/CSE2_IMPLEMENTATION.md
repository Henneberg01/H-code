# M11 experimental compiler work — real sign-first sequences

**Date:** 2026-10-18  
**Branch:** `feat/m11-symbol-sequences-spike`, stacked on `feat/cse-glyph-conditional` (PR #9) and earlier unmerged phases.  
**Status:** Source implementation and authored tests, **Rust compilation and full CI not yet executed**. M11 must NOT be marked completed and nothing may merge to `main` without full review.

## Language contract

Primary H-Code signs:
- `⟦1,2,3⟧`: homogeneous typed sequence value; `⟦⟦1⟧,⟦2⟧⟧` nested.
- `xs⟦i⟧`: checked, left-to-right evaluation of sequence and integer index. Negative, fractional and out-of-range indices raise deterministic errors.
- `⌗xs`: pure element count; `⌗1` is a type error.
- `xs ⧺ ys`: immutable concatenation; both sides must have the same element type; no host privileges or implicit AI.
- `⟦Number⟧` and `⟦⟦Number⟧⟧` are typed annotations. A naked `⟦⟧` lacks an element type and fails; `≔ xs:⟦Number⟧←⟦⟧;` or `ƒ empty() → ⟦Number⟧ ↩ ⟦⟧;` supplies that context.

Typed Rust AST nodes, recursive type unification, negative checks, compiler-to-JS emitter helper routines and JS reference parser/evaluator are all authored. Initial runtime helper limits sequence allocations to 16384 items, and the normal execution-fuel budget remains. Append can be implemented generically using `xs ⧺ ⟦value⟧` and works with nested sequences; the current immutable implementation is O(n) per concat, requiring later performance optimization.

## Actual general-purpose example

```hcode
ƒ sum(xs:⟦Number⟧) → Number {
  ≔ i←0;
  ≔ total←0;
  while(i<⌗xs) {
    total←total+xs⟦i⟧;
    i←i+1;
  }
  ↩ total;
}
print(sum(⟦2,3,5⟧));
```

Expected output: `10`. In the JS reference, this general user-authored H-Code implementation and similarly authored sequence transformations (map/filter) were directly executed. They are not task-specific compiler rewrites. See `compact/fixtures/m11-sum.hc`, `m11-map.hc`, and `m11-filter.hc`.

## Compatibility and independent verification

The M10 eight-case benchmark inputs and the alternative `◇` benchmark source files have **not** been edited. New M11 demonstration programs are **not** substituted into any historical corpus. Source-size claims require their own pinned TypeScript pairs, executable output parity and Git blob SHAs.

New tests:
- `prototype/test/symbol-sequences.test.mjs` — syntax, type contexts, runtime safety and map/filter/sum.
- `compiler/tests/symbol_sequences.rs` — true Rust parsing, inference, failure cases and emitted Node JS parity.
- Existing tests for M0–M9, pipelines `▷`, composition `∘` and conditionals `◇` must all pass.

Mandatory gate, **not yet performed**:
```sh
npm test
npm run studio:test
npm run phase1:test
npm run compact:test
cargo test --manifest-path compiler/Cargo.toml
npm run release:check
```
Without Rust and a full test run, this experimental branch is NOT green, ready to merge, released or evidence that the 70%-less-source hypothesis has been achieved. Once verified, review performance/allocation, source spans, SHA-locked package manifests and any remaining JS/Rust semantic differences before completing M11.

## Future milestones

M12 records; M13 generic package-scoped `⌕`, `⇢`, `∑` with first-class H-Code functions. A good-looking shorter source example is not enough: the sign must denote transparent, reusable, typed logic. No hidden AI, no application-specific macros.
