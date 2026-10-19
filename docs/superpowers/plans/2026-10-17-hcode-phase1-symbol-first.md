> Historical record: the licensing and branding assumptions in this document are superseded by the owner-directed JFH-CODE paid-use policy of 2026-10-19. See [current licensing](../../../LICENSING.md), [commercial terms](../../../COMMERCIAL.md) and [project principles](../../../JFH-CODE-PRINCIPLES.md). This document grants no current use permission.

# H-Code Phase 1 Symbol-First Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the M0–M9 symbol-first foundation by proving glyph/ASCII conformance across H-Code's two frontends, rejecting ambiguous/unsafe symbols, measuring compactness honestly, and improving H-Code Studio's sign-first experience.

**Architecture:** Keep the existing H-Code compiler and runtime. New paired `.hc` fixtures live under `phase1/fixtures/` so previous `examples/*.hc` enumeration remains unchanged. Dedicated Node/Rust conformance tests use the existing reference interpreter and Rust compiler, while a small offline metrics module reports source code points and bytes without implying execution speedup. Studio expands its current static palette and documents accessible aliases without adding an API route or a new parser.

**Tech Stack:** Node.js 20+ ESM, `node:test`, Rust 2021, `cargo test`, `hcode_compiler`, existing `studio/public/` plain JS/CSS/HTML, `Henneberg01/H-code` GitHub connector.

**Spec:** `docs/superpowers/specs/2026-10-17-hcode-phase1-symbol-first-design.md`

## Global Constraints

- **The project is H-Code**; it is an independent symbolic, general-purpose programming language and is **not** the FastSell platform.
- **Real signs are the primary .hc syntax**, not editor-only snippets. Text spellings remain secondary, accessible aliases with identical meaning.
- Morse-code inspiration means efficient **information density**, not an only-dots-and-dashes encoding. One sign may mean one explicitly typed, imported, inspectable operation.
- Preserve 15 implemented core signs (`ƒ ≔ ↩ → ← ⊤ ⊥ ∧ ∨ ¬ ≡ ≠ ≤ ≥ ∷`), reserve `∅ ∀ ∈`, and keep version-locked package signs `⊕ ▦ ⊙ ⊗` package-scoped.
- Existing `examples/`, `m4/`, `m5/`, `hcode.lock.json`, and manifest formats **must not break**. No symbol-DLS, package-manager redesign, general AI-app builder, WASM, or game engine in this slice.
- JavaScript and Rust may have different spans/diagnostic wording but **may not silently disagree on meaning/output or whether an unsafe glyph is accepted**.
- Source is UTF-8, normalized to NFC; forbid invisible/directional controls; imported user symbols require NFC/NFKC-stability and version-locked explicit imports.
- Only trusted .hc source may run: emitted JS has normal Node privileges and **is not sandboxed**; Studio stays localhost-only.
- Core and local Studio remain Apache-2.0. Owner: **Jonas Fogh Henneberg**, operating as **Fastsell.net**, CVR **46614887**, Denmark. Trademark/brand rules remain separate.
- The targets **70% shorter code, 2–5× developer speed, 25% fewer AI tokens** are **unproven targets**. Report Unicode code points separately from UTF-8 bytes; report AI token/developer-time data as unmeasured until actually assessed.
- Baseline verified on the existing Windows MCP workspace: **39 Node reference tests, 34 Rust tests, 13 Studio tests, and M9 release check green** (86 tests). Re-run after each relevant task and on final candidate.
- Local source root is `C:\fastsell-local-mcp-portable\projects\H-Code`, **not a Git repository**. Work with safe FastSell MCP file edits, then synchronize selected reviewed files to a GitHub feature branch with GitHub API tree+commit+ref. No merge, release tag, publication changes, unsolicited GitHub Actions run, or deployment.

## Review Focus

1. **Unicode ambiguity:** NFC-compatible glyph and the visually similar but NFKC-changing symbol must not silently reference a different operation. Task 2 pins rejection/error tests.
2. **Package collisions:** simultaneous imports exposing the same glyph must error unless namespaced; never resolve by import order. Task 2 pins a collision fixture/test.
3. **Unicode count vs actual bytes:** a one-character glyph can use more bytes than an ASCII token. Task 3 tests and reports such regressions instead of a false win.
4. **Source-path and artifact safety:** conformance/measurement scripts must not ingest arbitrary absolute paths, write beside user source files or commit secrets. Tasks 1 and 3 pin paths to fixed fixture inputs and use temporary build output only.
5. **Studio accessibility:** a glyph inserted using the palette must correspond to a real core token, with explicit accessible alias and cursor/focus preserved. Task 4 tests catalog coverage, JS parseability and existing Studio API safety.

---

## Preflight / shared interfaces

- **GitHub setup (documentation only until plan approved):** attach design and this plan to the existing `docs/phase1-symbol-first-design` branch without touching `main`. Implementer creates a **separate** `feat/phase1-symbol-conformance` branch from freshly resolved `main` after approval. Keep feature commits linear; use expected head SHA to reject lost updates.
- Existing JS API: `tokenize(source)`, `parse(source)`, `linkProgram(ast, registry)`, `execute(source, {registry,stdout})`, `loadLockedPackages(path)` from `prototype/src/{hcode,packages}.mjs`.
- Existing Rust API: `parse(source)`, `checker::check(&ast,&registry,true)`, `packages::load_lockfile(path)`, `codegen::emit(&typed,&registry)`. Rust CLI: `hcodec check|ast|build|run FILE.hc [--lock hcode.lock.json] [--out output.mjs]`.
- Existing Studio: `studio/public/app.js` is a classic script with static `symbols=[glyph,alias]`; `studio/server.mjs` serves only `/index.html`, `/app.js`, `/style.css`. Do not switch to ESM or add a static route.
- Task 2 uses Task 1's positive fixture pair inventory. Task 3 consumes exactly the same inventory, with `phase1/fixtures/manifest.json` listing basenames and optional `lock` filename. Task 4 consumes this report and updates docs/status. Preserve fixture schema exactly.
- Package manifests and source hashes are already pinned; do **not** edit `packages/demo.math/` or `hcode.lock.json` in this plan.

### Task 1: Paired native-symbol fixture conformance

**Files:**
- Create: `phase1/fixtures/manifest.json`, `phase1/fixtures/{functions,booleans,recursion,package}.{glyph,ascii}.hc` (eight files)
- Create: `prototype/test/phase1-parity.test.mjs`
- Create: `compiler/tests/phase1_parity.rs`

**Interfaces:**
- Produces: `manifest.json` with `{"format":1,"pairs":[{"id":"functions","output":"42\n","lock":false}, ...]}`; each `id` names `<id>.glyph.hc` and `<id>.ascii.hc`.
- The fixture set is read-only; no fixture may import relative local files or write outputs.
- Consumers: Task 3 reads this manifest with static, validated IDs.

- [ ] **Step 1: Write the Node conformance test** in `prototype/test/phase1-parity.test.mjs`. Read the manifest, assert `pairs.length===4` and IDs exactly `functions`, `booleans`, `recursion`, `package`. For every pair, load both .hc files; compare lexed tokens after replacing **only equivalent core signs** (package operation calls intentionally tokenize differently), compare `linkProgram(parse(...),registry)` after recursively removing only `line/column`, and compare captured `execute` output to each other and the manifest's exact `output`. Use `loadLockedPackages('hcode.lock.json')` only for `lock:true`.
- [ ] **Step 2: Run** `npm test`. **Expected RED:** ENOENT missing `phase1/fixtures/manifest.json` (real conformance cases absent, not a syntax error in the test).
- [ ] **Step 3: Add four fixtures** and a manifest in the following exact order:
  - `functions`: glyph `ƒ twice(n: Number) → Number { ↩ n * 2; } ≔ x ← twice(21); print(x);` and alias `fn twice(n: Number) -> Number { return n * 2; } let x = twice(21); print(x);`; expected `42\n`, `lock:false`.
  - `booleans`: glyph `≔ flag ← ⊤ ∧ ¬⊥; if (flag) { print(7); } else { print(0); }` and alias `let flag = true and not false; if (flag) { print(7); } else { print(0); }`; expected `7\n`, `lock:false`.
  - `recursion`: glyph `ƒ fac(n: Number) → Number { if (n ≤ 1) { ↩ 1; } ↩ n * fac(n - 1); } print(fac(5));` and alias `fn fac(n: Number) -> Number { if (n <= 1) { return 1; } return n * fac(n - 1); } print(fac(5));`; expected `120\n`, `lock:false`.
  - `package`: glyph `use "demo.math@1.0.0" as math; ≔ x ← ⊕(20, 22); print(x);` and alias `use "demo.math@1.0.0" as math; let x = math::add(20, 22); print(x);`; expected `42\n`, `lock:true`.
- [ ] **Step 4: Verify Node GREEN.** Run `npm test`. **Expected:** all prior 39 tests plus 4 new pair assertions pass, no additional missing imports.
- [ ] **Step 5: Write Rust integration test** `compiler/tests/phase1_parity.rs`: load same JSON manifest (`serde_json` already exists), parse/check/emit for both spellings, resolve only if necessary via existing `modules::resolve` with a fixture input path, load package registry for `lock:true`, assert emitted JS strings identical (canonical meaning) and captured `node --input-type=module --eval <emitted>` stdout equals expected. Run `cargo test --manifest-path compiler/Cargo.toml --test phase1_parity`. **Expected RED initially:** missing test implementation/fixtures or an observed emitter/semantics mismatch; if tests pass immediately as conformance-only, record coverage as verifying existing code, not falsely as new production feature.
- [ ] **Step 6: Repair only an actual witnessed mismatch** in `compiler/src/lexer.rs`, `parser.rs`, `checker.rs`, or `codegen.rs` with an additional test that first fails. Run Rust targeted test and `cargo test --manifest-path compiler/Cargo.toml`; **Expected:** all green. **Do not alter existing package IDs or semantics to force a test pass.**
- [ ] **Step 7: Commit** fixture/tests (and only proven repairs) on `feat/phase1-symbol-conformance` via the GitHub connector after reviewing hashes. Message: `test(phase1): prove glyph-first cross-frontend parity`.

### Task 2: Explicit symbol safety/ambiguity validation

**Files:**
- Create: `prototype/test/phase1-symbol-errors.test.mjs`
- Create: `compiler/tests/phase1_symbols.rs`
- Modify conditionally upon witnessed RED: `prototype/src/hcode.mjs`, `prototype/src/packages.mjs`, `compiler/src/lexer.rs`, `compiler/src/packages.rs`, `compiler/src/checker.rs`

**Interfaces:**
- Consumes the existing core glyph table, `hcode.lock.json` package loader and Task 1 manifest. No new grammar syntax is introduced.
- Produces reproducible safe/unsafe-input assertions, with stable error categories (not necessarily identical human-readable messages).

- [ ] **Step 1: Add negative conformance tests** that cover `print(⚡(1));` (unknown glyph), `let x = 1; //\u202E concealed` (bidi controls in comment), zero-width `\u200B` or `\u200D` in glyph/identifier, illegal reserved glyph usage `∅` without an import, rejection of NFKC-unstable manifest glyph `㎞` (which normalizes compatibly to ASCII `km`), and `use "demo.math@1.0.0" as m; print(⊕(2,3));` with a deliberately mismatched lockfile digest in a temporary fixture. Separate malicious manifests used in tests must be created in temporary directories and removed after, not written to the canonical `packages/` tree.
- [ ] **Step 2: Run targeted suites** `node --test prototype/test/phase1-symbol-errors.test.mjs` and `cargo test --manifest-path compiler/Cargo.toml --test phase1_symbols`. **Expected:** rejects each case; record any discrepancy as a failing regression, never mask it by catching all exceptions blindly.
- [ ] **Step 3: Add package ambiguity test** importing two temporary locked packages that export the same glyph `⊕`: unqualified `⊕(1,2)` must error; explicitly qualified package operation succeeds. Use existing `prototype/test/packages.test.mjs` and `compiler/tests/frontend.rs` helpers as patterns. No changes to permanent manifests.
- [ ] **Step 4: Run tests again**. **Expected RED** for any real previously uncovered safety bug (if all pass, log that hardening adds proof only, not an implementation feature). If RED, fix with the smallest compatible change and a specific regression case; run exact failing test GREEN.
- [ ] **Step 5: Run full `npm test`, `cargo test --manifest-path compiler/Cargo.toml`**. **Expected:** no regressions, unsafe or ambiguous input never silently executes.
- [ ] **Step 6: Commit** test coverage and proven fixes only. Message: `test(phase1): pin symbol ambiguity and Unicode safety`.

### Task 3: Honest offline compactness/benchmark measurement

**Files:**
- Create: `scripts/phase1-metrics.mjs`, `scripts/test/phase1-metrics.test.mjs`
- Modify: `package.json` to include `"phase1:measure": "node scripts/phase1-metrics.mjs"` and `"phase1:test": "node --test scripts/test/*.test.mjs"`
- Create (generated by command, not manually entered): `phase1/results/source-metrics.json`
- Modify: `docs/BENCHMARKS.md`

**Interfaces:**
- Consumes: `phase1/fixtures/manifest.json` + exactly eight fixture `.hc` paths from Task 1.
- Produces: export `measureSource(source: string): {codePoints:number,utf8Bytes:number,nonBlankLines:number}`; `measurePair(glyphSource: string, asciiSource: string): {glyph:...,ascii:...,changes:{codePointsPercent:number,utf8BytesPercent:number}}`.
- CLI prints JSON to stdout by default; optionally `--output phase1/results/source-metrics.json` using an exact allowlisted destination and `--repeat N` only for an explicitly enabled benchmark variant. Data contains `toolVersions`, `pairs`, `meaningsVerified`, and `aiTokens:null`, `developerTime:null` when not measured. No network dependencies.

- [ ] **Step 1: Write failing test** `scripts/test/phase1-metrics.test.mjs` importing `measureSource` and `measurePair` from `../phase1-metrics.mjs`; assert `measureSource('↩')` returns `{codePoints:1,utf8Bytes:3,nonBlankLines:1}`, `measureSource('return')` gives `{codePoints:6,utf8Bytes:6,nonBlankLines:1}`, and `measureSource('≡')` has **more bytes** than `measureSource('==')`.
- [ ] **Step 2: Run** `node --test scripts/test/phase1-metrics.test.mjs`. **Expected RED:** import of `phase1-metrics.mjs` fails because the module is absent.
- [ ] **Step 3: Implement** `measureSource(source)` via Unicode code-point iteration `Array.from(source).length`, `Buffer.byteLength(source,'utf8')`, and trimmed nonblank line counts; implement `measurePair` as honest reductions vs accessible spelling (include negative values). Reject empty ASCII baseline to prevent division by zero. Use `fileURLToPath` and exact manifest file IDs for CLI.
- [ ] **Step 4: Run** `node --test scripts/test/phase1-metrics.test.mjs`, then `npm test`. **Expected GREEN.**
- [ ] **Step 5: Add integration test** invoking `node scripts/phase1-metrics.mjs` to assert four manifest pairs and `aiTokens === null`; verify JSON toolchain metadata, locked fixture basename resolution and refusal to write outside `phase1/results/source-metrics.json`. **Expected RED** if CLI missing, then implement only that behavior and re-run GREEN.
- [ ] **Step 6: Generate result** with `npm run phase1:measure -- --output phase1/results/source-metrics.json`; record codepoints and UTF-8 bytes for every pair. Add a reproducible `cargo build --manifest-path compiler/Cargo.toml` + `npm run bench` command in `docs/BENCHMARKS.md` as a **distinct** performance metric, with no claims of source-size-driven runtime speedup. Where generated JS sizes or runtime timing were not measured, use explicit `not measured` rather than invented numbers.
- [ ] **Step 7: Run full `npm run phase1:test` and `npm run release:check`**. **Expected:** pass without credentials/network access.
- [ ] **Step 8: Commit** harness, generated provenance report and docs. Message: `feat(phase1): add honest symbol compactness measurements`.

### Task 4: Sign-first Studio and project continuity

**Files:**
- Modify: `studio/public/app.js` (only palette map + accessible button metadata), `studio/public/index.html` (message emphasizes real signs as primary spelling)
- Create: `studio/test/phase1-symbol-palette.test.mjs`
- Modify: `docs/SYMBOLS.md`, `docs/PROJECT_CONTINUITY.md`, `README.md` (introduce glyph example first), `docs/M9_STATUS.md` or create `docs/PHASE1_STATUS.md` for fresh test report

**Interfaces:**
- Consumes current `studio/public/app.js` plain JS `symbols = [[glyph,alias], ...]`; no new import route. Button click must continue using `source.setRangeText(glyph, ...)`, preserve selection and focus, call existing `changed()`.
- Produces complete palette coverage for the 15 implemented core glyphs, each with truthful alias/description via accessible `aria-label` and `title`. Keep `∅ ∀ ∈` reserved-only and user package glyphs documented (not injected as global core).

- [ ] **Step 1: Add a failing test** `studio/test/phase1-symbol-palette.test.mjs` with a static parse of actual `app.js` palette (or a minimal fake DOM if needed) asserting exact 15 glyph/alias entries, no reserved glyphs, nonblank labels and `source.setRangeText` insertion behavior. Assert H-Code source remains a real `.hc` program; never rewrite it into JavaScript at the UI boundary.
- [ ] **Step 2: Run** `npm run studio:test`. **Expected RED:** palette currently has 11 of 15 core signs (missing `≡ ≠ ≤ ≥`).
- [ ] **Step 3: Extend** existing `symbols` mapping in `studio/public/app.js` to all 15 signs with exact aliases `ƒ/fn`, `≔/let`, `↩/return`, `→/->`, `←/=`, `⊤/true`, `⊥/false`, `∧/and`, `∨/or`, `¬/not`, `≡/==`, `≠/!=`, `≤/<=`, `≥/>=`, `∷/::`. Set `aria-label` and `title` per button. Do not introduce new grammar or change API routes.
- [ ] **Step 4: Run** `npm run studio:test` and `node --check studio/public/app.js`. **Expected GREEN.** Add an HTTP assertion in existing `studio/test/http.test.mjs` only if needed to ensure CSS/JS same-origin routes remain available.
- [ ] **Step 5: Update** `README.md`, `docs/SYMBOLS.md`, `studio/public/index.html`, and continuity docs: explicitly explain that signs are source syntax, aliases are accessibility aids, versioned signs are typed imported operations, old examples still work. Quote measured values from Task 3 with code-point/byte caveats and leave AI-token/developer-time goals labeled unproven.
- [ ] **Step 6: Verify** full `npm test`, `npm run phase1:test`, `npm run studio:test`, `cargo test --manifest-path compiler/Cargo.toml`, `npm run release:check`, and sample `npm run demo`. **Expected:** no test regression; `docs/PHASE1_STATUS.md` records exact fresh counts, toolchain/compiler versions, revision SHA, measured data and known limitations.
- [ ] **Step 7: Review** new GitHub branch changes as a whole, focusing on glyph correctness, absence of unauthorized generated output/secrets, Unicode safety and project identity; fix important issues through fresh failing regression tests. Commit the changes and open **draft** PR into `main`, without merge or deployment. Message: `docs(phase1): document symbol-first foundations and verified conformance`.

## Completion checklist / handoff

- All four tasks executed on their own red/green cycles (or existing-behavior verification explicitly identified), with full suites green.
- At least four real paired fixture programs are executed and compared through reference interpreter and Rust compiler, not mocked or editor-expanded.
- A machine-readable result report demonstrates **actual** character and byte ratios; no implied guarantee of 70% compression, 2–5x development speed or 25% fewer AI tokens.
- Studio exposes all 15 core signs with accessible meanings and a preserved working editor, no new runtime privileges.
- A branch-scoped PR and persistent progress journal capture source and evidence for future conversations.
- **No merge to main, no visibility change, no public beta tag, no paid CI, no secrets, no deployment.**
