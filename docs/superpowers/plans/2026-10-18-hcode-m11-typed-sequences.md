# M11 / CSE-2 typed sequences — implementation plan (draft)
**Depends on:** verified M10 / PR #5 and review of Phase-1 PR #3. Track issue #6.  
**Result:** real typed List support in Rust and JS, not JSX/AI-transpilation or an application template.  
**Status:** plan only; all tasks unchecked.

## Execution discipline
One focused feature branch and draft PR *after* the dependency gate. Add failing tests first; run targeted checks plus `npm test`, `npm run studio:test`, `npm run compact:test` and `cargo test --manifest-path compiler/Cargo.toml`. Record passed/failed counts from actual runs; never copy prior counts as fresh evidence. Do not force-push, merge main, execute untrusted H-Code, or run paid automatic CI.

### Task 0 — freeze contract and baseline
- [ ] Confirm M10 is green on exact SHA, PR ancestry is understood and previous 15 glyphs plus pipeline remain valid
- [ ] Freeze 12 positive paired fixtures and ≥12 malformed/type/runtime cases, with expected output and errors
- [ ] Check syntax collision with existing package symbol inventory and reserves; benchmark old code before edits

### Task 1 — brackets and recursive List types
Files: `compiler/src/lexer.rs`, `compiler/src/parser.rs`, `compiler/src/ast.rs`, `prototype/src/hcode.mjs`.
- [ ] Add [ ] lexical tokens in both frontends without changing arithmetic / `▷` parsing
- [ ] Parse list literal expressions and high-precedence indexing with dedicated AST nodes/spans
- [ ] Parse nested `List<T>` in parameter/return types and optional typed `let` declarations
- [ ] Preserve old AST meaning on legacy files; verify malformed brackets and nested syntax fail early
- [ ] Verify `xs[1] ▷ double` and parenthesized pipeline-result indexing only where unambiguous

### Task 2 — Rust static List typing
Files: `compiler/src/checker.rs`, `compiler/src/ast.rs` and tests.
- [ ] Add `Type::List(Box<Type>)`, recursive unification/resolution/occurs/finalization
- [ ] Infer homogeneous literal element types; reject mixtures; forbid unannotated empty literals unless an expected List<T> is present
- [ ] Statically type-check index Number and known non-integral literal; maintain runtime check on dynamic index
- [ ] Support scalar and nested list functions, annotated empty-list bindings, return annotations and recursion
- [ ] Explicitly reject List contracts in package manifest v1 until v2 exists

### Task 3 — two minimal general list intrinsics
Files: `compiler/src/checker.rs`, `compiler/src/codegen.rs`, `prototype/src/hcode.mjs` and tests.
- [ ] Define fallback-polymorphic `len(List<T>) → Number` and pure `append(List<T>,T) → List<T>`
- [ ] Preserve user-defined `len`/`append` when they already exist; no global namespace clobbering
- [ ] Verify append rejects wrong types; source list is unmodified; arguments are evaluated exactly once
- [ ] Add predictable instruction/allocation resource checks; do not permit arbitrary host JS/AI calls

### Task 4 — Rust emitter and reference interpreter parity
Files: `compiler/src/codegen.rs`, `prototype/src/hcode.mjs`.
- [ ] Emit List values and checked index/len/append code paths; no raw unchecked JS index
- [ ] Validate integer, negative, fractional and out-of-bounds errors on both frontends
- [ ] Compare outputs of compiled Node JS and JS reference for all positive fixtures
- [ ] Verify nested list behavior, pure append and signed/locked demo packages

### Task 5 — general-purpose algorithm proof
- [ ] Implement a user-authored ordinary `sum(List<Number>)` in H-Code using len/index/while
- [ ] Implement a user-authored `doubleEach(List<Number>)` using typed empty lists and append
- [ ] Verify returned list values and side effects against idiomatic TypeScript equivalents
- [ ] No hidden built-in "generate webshop", "filter paid orders", or AI expanding these algorithms
- [ ] If either algorithm cannot be expressed, M11 is *not* complete; revise the design

### Task 6 — compatibility, Studio and benchmark
- [ ] Extend symbol palette/docs only for actual new language capabilities; keyboard and accessibility remain first-class
- [ ] Run 12+ sign/ASCII fixture pairs, 12+ error cases, old M0–M10 suites and all package integrity tests
- [ ] Measure source code points/bytes, generated JS, dependencies, runtime and memory; show losses without cherry-picking
- [ ] Create M11 draft PR with source commit hashes and actual test evidence; do not merge until review

## Definition of done
Every planned positive case runs through **both** frontends and compiled JS with identical observable output. Invalid List types and indexes fail with explicit type/runtime errors, even when input is dynamically computed. The language can express real variable-sized collection transformations as authored H-Code with no hidden templates. Full regressions pass on a verified SHA. The code-size target remains an unverified *research objective*, not a pass/fail substitute for correctness.
