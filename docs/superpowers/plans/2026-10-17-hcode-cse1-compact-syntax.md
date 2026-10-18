# H-Code CSE-1 Compact Syntax Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real, typed `▷` / `|>` pipelines and one-expression return functions in H-Code's existing Rust and JavaScript frontends while preserving legacy programs, and establish fair reproducible compactness measurements.

**Architecture:** Add one compiler-level pipeline token in both native lexers, lower pipelines to the existing `Call` AST representation, and lower compact functions to the existing `Function` + single `Return` body. Verify output and Rust static typing across actual `.hc` files; only later compare developer-authored H-Code against verified idiomatic TypeScript examples. Leave all other language and runtime capabilities unchanged.

**Tech Stack:** Node.js 20+ (ESM, node:test), Rust 2021 (`hcode_compiler`), generated Node.js JavaScript, existing locked package implementation, optional pinned TypeScript 5.9.3 as a **benchmark-only dev dependency**, existing plain-JS H-Code Studio.

**Spec:** `docs/superpowers/specs/2026-10-17-hcode-compact-syntax-design.md`  
**Roadmap:** `docs/H-CODE-MASTERPLAN-M0-M59.md` — new M10 / CSE-1  
**Parent branch:** `docs/compact-syntax-70pct-design` (inherits unmerged Phase-1 draft PR #3).  
**Implementation feature branch:** `feat/m10-cse1-compact-syntax` (create **after this plan is reviewed**).

## Global Constraints

- **H-Code** is the independent Morse-inspired, symbol-first, general-purpose programming language; do not rename it, turn it into a FastSell app builder, or claim it is only syntactic sugar for JS.
- Actual Unicode signs are compiler tokens; their ASCII aliases are secondary accessibility spellings with **identical meaning**. No AI involvement in compilation or runtime.
- New core **`▷` (U+25B7) / `|>`** denotes pipeline application, not a package-global magic operation. All 15 previous core signs remain unchanged. Reserve the new sign only after checking locked package collisions.
- New expression-return form **`ƒ f(args) → Type ↩ expr;`**, with accessible `fn/->/return`, lowers to the current function body `[Return(expr)]`. Existing braces/semicolons remain valid.
- `left ▷ f` = `f(left)`; `left ▷ f(a,b)` = `f(left,a,b)`. Left expression evaluates **exactly once**. Chains are left-to-right. Pipeline has lower precedence than all existing arithmetic/boolean operators.
- RHS is a callable identifier, package-qualified operation or package glyph, with optional explicit argument list; not an arbitrary expression, implicit lambda, or side-effectful computed callee. `a ▷ f + b` is deliberately rejected without explicit parentheses.
- New syntax is lowered **before type checking** to the existing `Call` representation: do not add hidden VM/JS string replacements, fallback eval, ambient imports or runtime capabilities.
- Keep `hcode.lock.json` / `demo.math` package manifests, M4/M5 sample applications, all existing public symbols and previous error categories compatible.
- No new lists, records, generics, generic package manifests, loops, automatic semicolon insertion, full IR optimizer, Internet operations or native/WASM targets in **CSE-1**; those are distinct future milestones.
- Security: emitted JavaScript inherits Node host privileges and **is not sandboxed**. Do not execute untrusted `.hc` source; Studio remains localhost-only.
- H-Code Core and source-shipped Studio are Apache License 2.0. Attribution: Jonas Fogh Henneberg / Fastsell.net (CVR 46614887), Denmark. Trademarks not asserted registered.
- Aspirational **70% fewer developer-authored source code points**, **2–5× faster human development**, **25% lower AI token usage** are **unverified targets**, not acceptance preconditions or marketing achievements.
- Benchmark source code points, UTF-8 bytes and total dependencies **separately**. Do not silently omit task-specific library source or compare H-Code abstractions with intentionally verbose TypeScript baselines.
- Documentation baseline from last verified Phase-1 run is **107 passing automated tests** (48 JS + 39 Rust + 16 Studio + 4 metrics), plus successful demo and release audit. Re-run on the actual work branch; never reuse old numbers as current evidence.
- The selected local H-Code workspace managed through FastSell MCP is **not** a Git worktree. Keep local operating-system paths out of public docs. Use guarded FastSell file writes (expected SHA-256), the GitHub connector's tree/commit/update-ref (with expected head SHA) and a new feature branch. Never overwrite `main`, merge, publish tags, change repo visibility, run paid CI automatically or leak local credentials.
- Existing draft PR #3 remains separate. Before implementing, verify it is still open/unmerged or adapt the chosen branch base with explicit provenance and no force push.

## Review Focus — five failure classes that the tasks must pin

1. **Ambiguous Unicode / package collisions:** importing a locked package that defines `▷` must be rejected, and `|>` must lex identically to `▷` in both frontends (Task 1).
2. **Side effects / duplicate evaluation:** `next() ▷ double` must invoke `next` exactly once, including when chained and supplied to a call with extra arguments (Tasks 3–5).
3. **Precedence / misleading parses:** `1 + 20 ▷ double` must mean `double(21)`, `a ▷ f + b` must error with a source location, while `(a ▷ f) + b` is accepted (Tasks 3–5).
4. **Static type and arity failures:** `1 ▷ nonCallable` and `1 ▷ add(2,3)` must fail in Rust checker instead of invoking unintended JS; H-Code interpreter must not silently reinterpret them (Tasks 3–5).
5. **Biased benchmarks:** a Unicode sign may be one code point but several bytes; a shorter H-Code program with a task-specific imported library cannot hide that library's source size. Report failed/unsupported comparisons (Task 6).

---

## Interfaces / file responsibility map

| Responsibility | Existing files modified | Focused tests and new artifacts |
| --- | --- | --- |
| Core token and sign reservations | `prototype/src/hcode.mjs`, `compiler/src/lexer.rs`, `compiler/src/packages.rs` | `prototype/test/compact-lexer.test.mjs`, `compiler/tests/compact_lexer.rs` |
| Short function body desugaring | `prototype/src/hcode.mjs`, `compiler/src/parser.rs` | `prototype/test/compact-functions.test.mjs`, `compiler/tests/compact_functions.rs` |
| JS reference pipeline parse/lowering | `prototype/src/hcode.mjs` | `prototype/test/compact-pipeline.test.mjs` |
| Rust pipeline parse/typed lowering | `compiler/src/parser.rs`; only if proven necessary `checker.rs` | `compiler/tests/compact_pipeline.rs` |
| Cross-frontend executable fixture corpus | No grammar code | `compact/fixtures/manifest.json`, 12 `.hc` files; `prototype/test/compact-conformance.test.mjs`, `compiler/tests/compact_conformance.rs` |
| Fair source metrics + TypeScript baseline | `package.json` (+ lockfile); no compiled H-Code semantics | `scripts/compact-metrics.mjs`, `scripts/test/compact-metrics.test.mjs`, `compact/benchmarks/typescript/*.ts`, `compact/results/cse1.json` |
| Studio/user docs/release | `studio/public/app.js`, `docs/SYMBOLS.md`, `README.md`, `.github/workflows/test.yml` | `studio/test/compact-symbol-palette.test.mjs`, `docs/CSE1_STATUS.md` |

**Existing APIs:** `prototype/src/hcode.mjs` exports `tokenize(source)`, `parse(source)`, `linkProgram(ast,registry)`, `execute(source,{registry,stdout})`. Rust compiler exports `lexer::lex(source)`, `parser::parse(source)`, `checker::check(&ast,&registry,true)`, `codegen::emit(&typed,&registry)`. Existing `Call` shapes are JS `{kind:'Call',callee,args}`, Rust `ExprKind::Call{callee:Box<Expr>,arguments:Vec<Expr>}`; **do not introduce new AST-level Pipe nodes**.

**GitHub commit procedure (every task):** Read only newly changed allowlisted source files, reject paths with secrets or generated binaries, create a tree from a fresh feature-head commit's `tree.sha`, create a commit with the feature-head as sole parent, then `update_ref` on `feat/m10-cse1-compact-syntax` using `expected_sha`. Verify new head and file tree after each commit; never update `main`. FastSell workspace writes use `expectedSha256` when replacing files.

### Task 1: Lexer-level pipeline signs and collision protection

**Files:**
- Modify: `prototype/src/hcode.mjs` (`CORE_GLYPHS`, `TWO`)
- Modify: `compiler/src/lexer.rs` (`TokenKind`, core glyph and pair-token match)
- Modify: `compiler/src/packages.rs` (`reserved_glyph` table)
- Create: `prototype/test/compact-lexer.test.mjs`
- Create: `compiler/tests/compact_lexer.rs`
- Test: `prototype/test/phase1-symbol-errors.test.mjs`, `compiler/tests/phase1_symbols.rs`

**Interfaces:** Produces **JavaScript token `type:'|>'`** for both spellings and **Rust `TokenKind::Pipe`** for both spellings. Reserves `▷` as a core glyph only if the committed locked package manifest inventory does not already use it. No parser changes in this task.

- [ ] **Step 1: Scan every version-locked operation glyph** in the project for `▷`; assert it is not already allocated or stop and document migration. Confirm U+25B7 remains NFC/NFKC stable.
- [ ] **Step 2: Add failing lexer tests**: JS `tokenize('1 ▷ f;')` and `tokenize('1 |> f;')` produce equal semantic token kinds; Rust `lex(...)` outputs `Pipe`; bare `|` is illegal; spoofing/forbidden Unicode remains rejected. In package safety tests, a temporary manifest exporting `▷` must be rejected as reserved.
- [ ] **Step 3: Run RED tests**: `node --test prototype/test/compact-lexer.test.mjs`, `cargo test --manifest-path compiler/Cargo.toml --test compact_lexer`. Expected: missing token support or assertion errors specifically naming `▷`/`|>`; not a test-loader mistake.
- [ ] **Step 4: Implement minimal lexical changes**. Extend `CORE_GLYPHS` with `'▷':'|>'` and `TWO` with `|>`, preserving the existing output of legacy glyphs. Add Rust `TokenKind::Pipe`, U+25B7 core sign mapping, `('|',Some('>'))` pair match, and Rust reserved sign policy for `▷`. Do not add `∑`/`⌕`/`⇢` as language-global signs.
- [ ] **Step 5: Run GREEN** for both targeted tests and existing Unicode/package safety suites, then `npm test` and `cargo test --manifest-path compiler/Cargo.toml`; expected no parser or legacy regression for programs that do not use the new operator.
- [ ] **Step 6: Commit** changed files and tests only: `feat(cse1): lex real Unicode and ASCII pipeline signs`.

### Task 2: Short return-expression functions in both parsers

**Files:**
- Modify: `prototype/src/hcode.mjs` (`Parser.stmt`)
- Modify: `compiler/src/parser.rs` (`Parser::statement`)
- Create: `prototype/test/compact-functions.test.mjs`
- Create: `compiler/tests/compact_functions.rs`

**Interfaces:** Existing JS `Function` retains `body:{kind:'Block',body:[{kind:'Return',value:...}]}`. Rust `StmtKind::Function{body: Vec<Stmt>}` receives exactly one `StmtKind::Return(expr)`. No new function AST/codegen type and no retyping of existing declarations.

- [ ] **Step 1: Write failing equality tests**: parse `ƒ sq(n: Number) → Number ↩ n*n;` and `fn sq(n: Number) -> Number { return n*n; }`; strip spans and require the same semantic AST in both frontends. Assert both print `25` after `print(sq(5));`.
- [ ] **Step 2: Add negative tests**: no trailing `;` after expression-bodied function; type mismatch between return annotation and expression; malformed `ƒ f() → ↩ 1;`; old brace forms and exported functions must remain supported. Include `ƒ f() ↩ 1;` and secondary spelling `fn f() return 1;`.
- [ ] **Step 3: Run RED**: `node --test prototype/test/compact-functions.test.mjs` and `cargo test --manifest-path compiler/Cargo.toml --test compact_functions`. Expected: failure at expected `{` / `LeftBrace`, demonstrating missing shorthand.
- [ ] **Step 4: Implement** conditional body parsing after the parameter list/optional return type: if `{`, run existing `block()`; otherwise require `return`/`↩`, parse expression, demand `;`, construct the same current one-return body. Preserve return scope and function `Span`; ensure nested expressions behave.
- [ ] **Step 5: Run GREEN** targeted test and existing `npm test` + full `cargo test`, verifying declared typed and inferred untyped functions.
- [ ] **Step 6: Commit**: `feat(cse1): allow one-expression returning functions`.

### Task 3: JS reference interpreter — typed-behavior pipeline desugaring

**Files:**
- Modify: `prototype/src/hcode.mjs` (`Parser.expr`; add `Parser.pipeTarget()` helper)
- Create: `prototype/test/compact-pipeline.test.mjs`

**Interfaces:** Consumes canonical token `'|>'` from Task 1; produces existing `Call` AST with `callee` from a real identifier/qualified operation/glyph and `args:[left,...explicitArgs]`. No compiler-agnostic transpilation/regex or new execution API. `expr(min)` consumes a pipeline only for `min<=0`; existing operators bind more tightly.

- [ ] **Step 1: Write failing AST/behavior tests** for `21 ▷ double`, `21 |> double`, `20 ▷ add(22)`, `20 ▷ math∷⊕(22)`, `20 ▷ inc ▷ double`, `1 + 20 ▷ double`; assert exact canonical `Call` nesting, output and alias parity. Locked package calls use `loadLockedPackages('hcode.lock.json')`.
- [ ] **Step 2: Add bad-target and side-effect tests**: `a ▷ f + b` rejects; `a ▷ (f)` rejects (CSE-1 has no computed RHS); `a ▷ 3` rejects; malformed `a | > f` rejects; `ƒ next() → Number { print(1); ↩ 21; } print(next() ▷ double);` outputs **`1\\n42`** exactly once; `(1 ▷ double) + 1` is legal.
- [ ] **Step 3: Run RED**: `node --test prototype/test/compact-pipeline.test.mjs`. Expected: parser stops at `|>` rather than compiling.
- [ ] **Step 4: Implement `Parser.pipeTarget()`**. Accept only identifier, qualified member or package glyph, optionally with a call argument list; return `{callee,args}`. In `expr(min)`, consume pipeline at lower precedence than `or`; desugar `left |> target(args)` into `Call(callee,args:[left,...args])`. Explicitly reject trailing unparenthesized arithmetic/comparison after a completed pipe target; preserve source-located `HCodeError`. Do not evaluate left twice.
- [ ] **Step 5: Run GREEN** targeted test and all `npm test`; verify Phase-1 four symbol/alias fixture outputs still match.
- [ ] **Step 6: Commit**: `feat(cse1): lower sign pipelines in reference interpreter`.

### Task 4: Rust parser — checked pipeline desugaring and runtime parity

**Files:**
- Modify: `compiler/src/parser.rs` (`Parser::suffixes`; add `Parser::pipe_target()`)
- Modify **only if new RED demonstrates necessity**: `compiler/src/checker.rs` (arity/type diagnostics)
- Create: `compiler/tests/compact_pipeline.rs`

**Interfaces:** Consumes `TokenKind::Pipe` from Task 1. Produces existing `Expr{kind:ExprKind::Call{callee:Box<Expr>,arguments:vec![left,...args]},span:left.span}`, which flows unchanged through `checker::check` and `codegen::emit`. No special pipe backend or changes to generated JS security model.

- [ ] **Step 1: Write failing Rust lexer/parser/AST comparison tests** for `▷` vs `|>`, lower precedence than `or`, left-associative chains, package alias + glyph calls, and the same `Call` AST as explicit `f(x)`. Keep source-location differences separate from semantic AST equivalence.
- [ ] **Step 2: Write Rust check/emit/run tests**: parse typed H-Code; run `check(&ast,&registry,true)`, `codegen::emit(...)`, execute emitted JS via `node --input-type=module --eval`, require exactly expected output for direct, chained, package and single-evaluation cases.
- [ ] **Step 3: Add negative tests**: `≔ f ← 2; print(1 ▷ f);` fails **TYPE** (non-callable); define `ƒ add(a: Number,b: Number) → Number ↩ a+b;` then `print(1 ▷ add(2,3));` fails **TYPE** (wrong arity); `1 ▷ f + 2` fails **PARSE**; missing expression/invalid symbol/unknown imported op fail with line+column; with a defined `f`, `(1 ▷ f)+2` succeeds.
- [ ] **Step 4: Run RED** `cargo test --manifest-path compiler/Cargo.toml --test compact_pipeline`. Expected: parser failure at `Pipe` and explicit errors, not interpreter crash.
- [ ] **Step 5: Implement `Parser::pipe_target() -> Result<(Expr,Vec<Expr>),Diagnostic>`** using only allowed callable syntax and existing `DoubleColon`/glyph parsing. In `Parser::suffixes`, desugar at minimum precedence (below `Or`), preserve argument order and left span; reject ambiguous arithmetic without parentheses. Use existing `Call` typed semantics for arity and type errors.
- [ ] **Step 6: Run GREEN** targeted Rust test and `cargo test --manifest-path compiler/Cargo.toml`; run `npm test` as independent reference regression.
- [ ] **Step 7: Commit**: `feat(cse1): statically check and emit typed symbol pipelines`.

### Task 5: Six real positive programs + negative cross-frontend conformance

**Files:**
- Create: `compact/fixtures/manifest.json`
- Create: paired `compact/fixtures/{short_function,direct,chain,precedence,prepend,package}.{glyph,ascii}.hc`
- Create: `prototype/test/compact-conformance.test.mjs`
- Create: `compiler/tests/compact_conformance.rs`

**Interfaces:** Manifest format `{ "format":1, "pairs":[{"id":"short_function","output":"25\\n","lock":false}, ...] }`. Allowed IDs **in exact order**: `short_function,direct,chain,precedence,prepend,package`. Outputs are `25\\n,42\\n,42\\n,42\\n,42\\n,42\\n`. Each file is a **literal `.hc` file**, not a generated JS/Studio shortcut.

- [ ] **Step 1: Add cross-frontend tests before fixtures** that read manifest and both spellings, compare linked semantic AST (exclude spans only), capture JS-reference `execute` output, compile Rust checked code and assert emitted JS and actual Node stdout are equal to corresponding manifest expectation. Require exactly six pairs and exact IDs.
- [ ] **Step 2: Run RED**: `node --test prototype/test/compact-conformance.test.mjs` and `cargo test --manifest-path compiler/Cargo.toml --test compact_conformance`. Expected: `compact/fixtures/manifest.json` missing.
- [ ] **Step 3: Add six matched programs**, using names and behavior:
    - `short_function`: `ƒ sq(n: Number) → Number ↩ n*n; print(sq(5));` ↔ `fn sq(n: Number) -> Number return n*n; print(sq(5));` → `25`.
    - `direct`: `ƒ twice(n: Number) → Number ↩ n*2; print(21 ▷ twice);` ↔ keyword form + `21 |> twice` → `42`.
    - `chain`: `ƒ inc(n: Number) → Number ↩ n+1; ƒ twice(n: Number) → Number ↩ n*2; print(20 ▷ inc ▷ twice);` ↔ alias form → `42`.
    - `precedence`: `ƒ twice(n: Number) → Number ↩ n*2; print(1+20 ▷ twice);` ↔ alias form → `42`.
    - `prepend`: `ƒ add(a: Number,b: Number) → Number ↩ a+b; print(20 ▷ add(22));` ↔ alias form → `42`.
    - `package`: `use "demo.math@1.0.0" as math; print(20 ▷ math∷⊕(22));` ↔ `use "demo.math@1.0.0" as math; print(20 |> math::add(22));` → `42`.
- [ ] **Step 4: Add ≥6 negative assertions** on matching glyph/alias inputs: missing semicolon, empty pipe RHS, pipeline RHS number, pipeline noncallable binding, wrong arity, unknown/ambiguous glyph, forbidden bidi, and `a ▷ f + b`. Error categories must be known, source located; no silently swallowed JS exception.
- [ ] **Step 5: Run GREEN** JS/Rust conformance targets, all `npm test`, all `cargo test --manifest-path compiler/Cargo.toml`, and Phase-1 fixtures.
- [ ] **Step 6: Commit**: `test(cse1): prove six symbol-first programs across frontends`.

### Task 6: Baselines that cannot fake 70% compactness

**Files:**
- Create: `scripts/compact-metrics.mjs`
- Create: `scripts/test/compact-metrics.test.mjs`
- Create: `compact/benchmarks/typescript/{short_function,direct,chain,precedence,prepend,package}.ts` plus shared module `compact/benchmarks/typescript/demo-math.ts` for fair reuse and `compact/benchmarks/typescript/tsconfig.json` (strict NodeNext compilation; output under ignored `dist/cse1-ts/`)
- Create: `compact/results/cse1.json` generated by CLI
- Modify: `package.json` (commands, pinned devDependency), create/update `package-lock.json`
- Modify: `docs/BENCHMARKS.md`

**Interfaces:** Export `countSource(source:string):{codePoints:number,utf8Bytes:number,nonBlankLines:number}` and `reportPair(hcode:string,typescript:string):{hcode:...,typescript:...,reduction:{codePointsPercent:number,utf8BytesPercent:number}}`. `node scripts/compact-metrics.mjs --output compact/results/cse1.json` writes only that exact allowlisted path. Manifest IDs from Task 5; each TypeScript benchmark must have a tested equal stdout.

- [ ] **Step 1: RED unit tests** for `countSource('▷') → {codePoints:1,utf8Bytes:3,nonBlankLines:1}`, `countSource('|>') → {2,2,1}`, negative byte savings, zero-length baseline rejection, and exact output-path validation. Run `node --test scripts/test/compact-metrics.test.mjs`. Expected import/CLI failure until implementation.
- [ ] **Step 2: Add six idiomatic TypeScript baselines** that implement exactly the six H-Code tasks, not minified code. Use the reusable `demo-math.ts` library **only** with the package task; charge any specifically written helper source to developer-authored or custom-library totals as applicable, consistently on both sides. Do not deliberately inflate TypeScript code with redundant boilerplate/comments.
- [ ] **Step 3: Pin a benchmark-only TypeScript compiler dependency and CLI scripts**: `npm install --save-dev --save-exact typescript@5.9.3`, commit exact `package-lock.json`, and define `compact:measure` = `node scripts/compact-metrics.mjs` and `compact:test` = `node --test scripts/test/compact-metrics.test.mjs` in `package.json`. `npm ci` and `npx --no-install tsc -p compact/benchmarks/typescript/tsconfig.json` must be reproducible on Node 20+. The TypeScript project config uses `target: ES2022`, `module/moduleResolution: NodeNext`, `strict:true`, `rootDir: .` and `outDir: ../../../dist/cse1-ts`, never writing generated JS beside `.ts` files. No runtime `hcodec` dependency on TypeScript, no network when rerunning tests from a cached install.
- [ ] **Step 4: Implement `countSource`, `reportPair`, CLI**. Normalize CRLF to LF, count Unicode code points and UTF-8 bytes separately, record individual file sizes, machine/tool versions, paired output checks and separate first-party library/dependency sizes. Run actual compiled TypeScript and actual H-Code for identical expected stdout. The report has explicit `typescriptOutputVerified` flags, `aiTokens:null`, `developerTime:null` and does **not** extrapolate 6 results to 20.
- [ ] **Step 5: GREEN metrics test and output verification**. `node --test scripts/test/compact-metrics.test.mjs` and `npm run compact:measure -- --output compact/results/cse1.json` pass. Assert the generated report contains six rows, exact source/byte counts, the TypeScript verification indicator and explicit custom-library dependency totals. Reject `--output ../outside.json`.
- [ ] **Step 6: Update `docs/BENCHMARKS.md`** with actual results/limitations: code points **vs idiomatic TypeScript** (not Phase-1 glyph-vs-alias), UTF-8 bytes, dependency footprints, generated JS artifact size if measured, separate runtime and developer productivity, exact commands and raw JSON. Mark unsupported 20-program tasks `not supported`, not zero-length.
- [ ] **Step 7: Run `npm test`, `npm run compact:test`, `npm run release:check`** and ensure no API key, generated `node_modules` or executable leaks into the commit.
- [ ] **Step 8: Commit**: `test(cse1): benchmark compact H-Code against fair typed TS baselines`.

### Task 7: Studio glyph UX, full regression, release evidence and draft PR

**Files:**
- Modify: `studio/public/app.js` (add `▷` / `|>` exactly once in the core glyph palette)
- Create: `studio/test/compact-symbol-palette.test.mjs`
- Modify: `docs/SYMBOLS.md`, `README.md`, `docs/H-CODE-MASTERPLAN-M0-M59.md` only if findings require, `.github/workflows/test.yml` (manual-only `workflow_dispatch`, add new tests)
- Create: `docs/CSE1_STATUS.md`
- Preserve: `H-CODE-PRINCIPLES.md`, `LICENSE`, `TRADEMARKS.md`

**Interfaces:** Studio palette inserts real Unicode `▷` at cursor, shows title/aria-label with alias `|>` and invalidates stale AI proposal approval. Source is saved as actual `.hc` code; no browser-side translation. Docs record fresh tests/metrics and explicit gaps.

- [ ] **Step 1: Write RED Studio test** asserting 16 implemented core symbols (15 prior + `▷`), correct alias/title/aria, insertion of `▷`, focus/cursor retained, `clearApproval()` invoked after insertion, no fabricated global `∑` glyph.
- [ ] **Step 2: Run RED**: `npm run studio:test`. Expected missing `▷` entry, while all earlier 16 Studio tests remain green.
- [ ] **Step 3: Implement one palette entry** in `studio/public/app.js`; do not restructure the working editor or weaken save/review behavior.
- [ ] **Step 4: Run GREEN**: `npm run studio:test`, `node --check studio/public/app.js`.
- [ ] **Step 5: Update docs and CI**. Extend symbols page with precedence, RHS restrictions, examples and ASCII equivalent; verify Task 6's existing `compact:measure`/`compact:test` package scripts, add manual-only workflow steps for tests and TypeScript baseline compile. `docs/CSE1_STATUS.md` records fresh check counts, fixture outputs, runtime constraints, benchmark raw paths, branch SHA and known gaps.
- [ ] **Step 6: Full acceptance tests**: `npm test`, `cargo test --manifest-path compiler/Cargo.toml`, `npm run studio:test`, `npm run phase1:test`, `npm run compact:test`, `npm run compact:measure -- --output compact/results/cse1.json`, `npm run demo`, `npm run release:check`. Expect **zero failures**; count each suite from fresh output instead of assuming historical 107. Check `M4/M5` demo workflows and verify no package v1 digest changed.
- [ ] **Step 7: Perform source and secrets review**. Compare full branch against intended ancestor and current main; scan only safe files, inspect full patch for accidental license/branding mutation, trust boundary violations and missing tests. Do not promote to public beta because the repository is already publicly visible but no release is approved.
- [ ] **Step 8: Commit**: `docs(cse1): complete symbol-first compact syntax and verified evidence`. Open **draft PR** from `feat/m10-cse1-compact-syntax` into the appropriate reviewed base (normally Phase-1 branch until PR #3 is merged, otherwise latest compatible main), noting dependency on PR #3. **Do not merge**, run paid CI, publish tag or deploy.

## Completion acceptance and handoff

- Every CSE-1 syntax change works in **actual source**, not a Studio transformation or optional AI.
- Six positive symbol/ASCII source pairs have the same typed outcome and executable outputs on JS reference and Rust-compiled JS; at least six negative cases correctly fail, including single evaluation, precedence, Unicode and type/arity checks.
- Earlier `.hc` programs, package manifests, M4/M5 examples and all regression suites still work.
- Offline comparative results include honest code-point, byte and dependency-size totals; **no fake 70% or universal claim**.
- H-Code Studio exposes `▷` with accessibility alias `|>` and invalidates pending AI edit approvals.
- A GitHub branch + draft PR and persistent status doc contain the evidence. Keep `main` unchanged pending explicit approval.

**Only CSE-1/M10 is authorized for the first implementation plan.** M11–M59 are in the separately versioned master milestone document and require their own bounded designs/acceptance gates.

**Recommended execution approach after plan review:** native sequential execution with explicit per-task regression and branch review. The lexer/parser/typechecker work is tightly coupled; independent full-branch review is recommended before merging.
