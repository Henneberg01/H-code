# JFH-CODE

**JFH-CODE** is an experimental typed, symbol-first programming language inspired by Morse-code-style information density: a real Unicode sign can stand for a precise, reusable, typed operation. The glyph is actual compiler-recognized source syntax, **not** a visual replacement for JavaScript. ASCII aliases are secondary accessibility spellings with the same semantics. JFH-CODE is an independent project, not a FastSell platform feature.

Copyright © 2026 **Jonas Fogh Henneberg**, operating as **Fastsell.net** (CVR **46614887**), Denmark.

**Project identity and durable language rules:** [JFH-CODE-PRINCIPLES.md](JFH-CODE-PRINCIPLES.md). Signs are source code — never only visual shortcuts.

## Source code must be signs first

JFH-CODE is a **symbolic language**, not TypeScript with replacement characters.
The primary executable notation is built around typed signs. New general
operators include `↧` (stable numeric-key sorting) and `⎙` (output), in
addition to `⇢`, `⌕`, `∑` and `⧉`. Conventional ASCII spellings exist for
accessibility only. For any new programming feature, we require source code
that demonstrates shorter, real computation **without** app-specific macros.

```hcode
≔ xs←⟦⦃name:"Ada",score:5⦄,⦃name:"Bo",score:9⦄⟧
⎙(⤒(xs↧λr:r·score))
```

These are **development-branch capabilities**, not a released JFH-CODE
compiler guarantee. [Symbol-first M19.15 correction](compact/canonical20/SYMBOL-FIRST-M19-15.md)
documents the source audit, locked evidence and remaining SQL syntax debt.
The 70% source-character reduction across the original twenty workloads
is a research objective, not an achieved project-wide result.

On the current development branch, **all twenty original acceptance workloads
pass**, including actual Chromium UI execution, persistent sessions and WebSocket
chat. [Acceptance evidence and source inventory](compact/canonical20/ACCEPTANCE-20.md)
record the 2026-10-20 run and the remaining competitive TypeScript baseline audit.
The raw mixed-comparison median is **69.71% fewer code points**; eight comparisons
use correctness oracles, so this is **not** a certified twenty-task reduction.



## Write JFH-CODE with real signs

These are executable JFH-CODE programs using the same imported typed operation:

```hcode
use "demo.math@1.0.0" as math;
≔ answer ← ⊕(20, 22);
print(answer);
```

Accessible alternative:

```hcode
use "demo.math@1.0.0" as math;
let answer = math::add(20, 22);
print(answer);
```

Both print `42`. The imported `⊕` denotes an inspected, version-locked function and is **not** globally hardcoded. See [symbol reference](docs/SYMBOLS.md) and [phase-1 results](docs/PHASE1_STATUS.md). Signs are the preferred spelling; every core sign has a searchable alias.

## Start locally

Requires Node.js **20+** and the stable Rust toolchain; the complete acceptance workflows require **Node 22.13+**. WebSocket serving uses the SRI-locked maintained ws dependency. In the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
cargo test --manifest-path compiler/Cargo.toml
npm run studio:test
cargo run --manifest-path compiler/Cargo.toml -- run examples/hello_ascii.hc
npm run language:test
npm run studio
```

Studio runs at **http://127.0.0.1:4317/** on the local computer. It can open, save, check, build and run JFH-CODE. It also supports reviewed AI code-edit proposals, optionally generated using a separately billed OpenAI API key. Using a ChatGPT subscription does not pay for the API.

The development compiler also provides `hcodec test PATH` and the typed assertion
sign `⊨(condition)` (ASCII alias `assert`). Test files use `.test.hc`, run through
the real compiler, and fail on false conditions, missing assertions or timeouts.
See [testing programs](docs/TESTING.md). `npm run test:example` runs an illustrative
module-and-test comparison with TypeScript using Node 22+; it does not change or
complete the frozen twenty-workload benchmark.

## Features

- **M1:** JS reference interpreter, user-defined glyph libraries, SHA-256-locked packages.
- **M2:** Rust lexer/parser and static type checking.
- **M3:** typed JFH-CODE to JavaScript compilation; `hcodec build` and `hcodec run`.
- **M4:** local `.hc` modules, explicit function exports and starter math/text library.
- **M5:** invoice, inventory and savings calculation demos (not complete production apps).
- **M6:** JFH-CODE Studio local web editor.
- **M7:** model-assisted structured edits with diff review and explicit approval.
- **M8:** basic loop and recursion limits and local HTTP safeguards — **not** a sandbox.
- **M9:** beta staging and governance, **not yet a public release**.

## Symbol compactness: measurements, not promises

Four equivalent programs reduced Unicode code points by **11.39–18.92%** but UTF-8 bytes by only **0–5.88%**. The 70% smaller code, 2–5× developer speed and 25% fewer AI tokens are research targets **not yet verified**. Run `npm run phase1:test` and `npm run phase1:measure` for reproducible evidence. See [raw data](phase1/results/source-metrics.json) and [measurement policy](docs/BENCHMARKS.md). Runtime speed and AI tokens were **not** measured by this compactness experiment.

## License and commercial offering

**JFH-CODE requires a separate valid paid commercial agreement. No free use license is offered.** The compiler, reference interpreter, Studio and project-authored runtime are proprietary. Source access does not grant permission to run, modify, redistribute or host the current software. Developers retain ownership of their own original application code; their agreement must grant any required embedded-runtime and application-distribution rights. Read [LICENSE](LICENSE), [LICENSING.md](LICENSING.md) and [COMMERCIAL.md](COMMERCIAL.md). Official branding is governed separately by [TRADEMARKS.md](TRADEMARKS.md).

## Security and limitations

**Only run JFH-CODE from trusted authors.** Generated JavaScript has Node.js host privileges and is not isolated. Studio should never be exposed to the public network. There is no production readiness or measured superiority claim; see SECURITY.md and docs/M9_STATUS.md.

## Release and contributing

Read docs/RELEASING.md and CONTRIBUTING.md. Run `npm run release:check` when preparing a candidate. The GitHub Actions workflow is manual-only to prevent unplanned Actions credit usage.

## Experimental Compact Syntax Engine (development branch only)

M10 / CSE-1 adds a compact expression-return form and typed pipelines in the Rust and JavaScript frontends (subject to CI and review):

```hcode
ƒ double(x) ↩ x*2;
print(21 ▷ double);
```

Expected output: `42`. ASCII equivalent: `fn double(x) return x*2; print(21 |> double);`.

See `docs/CSE1_STATUS.md`, `docs/SYMBOLS.md`, and the 60-milestone masterplan. This is **not merged into main**, has **no confirmed test pass** yet, and is not a sandbox or evidence of 70% shorter code.

## Experimental sign-first conditional expressions (unreleased)

The symbol `◇` is a typed, lazy *expression-level choice*, not a keyword abbreviation. For example:

```hcode
ƒ fact(n) ↩ n≤1 ◇ 1 : n*fact(n-1);
print(fact(5));
```

Expected `120`. The compiler checks Boolean conditions and matching arm types; only the chosen arm executes. ASCII fallback: `?`. See `docs/SYMBOL-CHOICE.md` for semantics and **same-task** source-count evidence. This feature is on a draft branch, **not merged or fully Rust-tested**.

## Experimental higher-order collection signs — `∑`, `⌕`, `⇢` (unreleased)

These are real Unicode-first JFH-CODE operations in both compilers' source code, using typed, general-purpose array semantics, not AI or hardcoded commerce tasks:

```hcode
ƒ positive(n) ↩ n>0;
ƒ twice(n) ↩ n*2;
print(∑(⟦-1,2,3,-2⟧⌕positive⇢twice));
```

Expected output: `10`. Real static type constraints: `⌕:⟦T⟧×(T→Bool)→⟦T⟧`, `⇢:⟦T⟧×(T→U)→⟦U⟧` and `∑:⟦Number⟧→Number`. Accessible ASCII aliases exist but are not the primary language. Full Rust/Cargo tests and upstream PR integration are still pending; `main` remains unchanged.

Same-task SHA-pinned benchmark: `compact/benchmarks/m13/`, run `npm run m13:measure`. This **three-task** source-only comparison shows a provisional **56.15% median fewer Unicode code points versus the unchanged TypeScript programs**; it is not the final 20-task 70% result. See `docs/M13-COLLECTION-SIGNS.md`.

## M14 experimental first-class unary signs (unmerged)

The latest development branch adds **typed `λ` closures** and unary operator sections like `(*2)` / `(>0)` to eliminate otherwise repetitive function declarations without hiding implementation logic:

```hcode
≔ ys←⟦10,11⟧⇢(*2);
print(ys⟦0⟧);
print(ys⟦1⟧);
```
Expected output: `20`, `22`. Function sections capture their right operand once, execute generically and are checked by Rust's type-inference system.

In a frozen three-task comparison, interim median JFH-CODE source size improved from 56.15% to **68.46% fewer Unicode code points** than the unchanged idiomatic TypeScript inputs. Byte-size reduction median **55.09%**. **This is not a 20-case study or proof of 70% across all programs.** Reproduce with `npm run m14:measure`, see `docs/M14-SYMBOL-LAMBDAS.md`.

**Draft feature branch, not merged/released; cargo tests and full CI pending.**

## M15 branch — sign-first control syntax and fewer delimiters

```hcode
≔n←0⟳(n<3)⇒n←n+1
print(n)
```

`⊢` / `⊣` / `⟳` and `⇒` are real Rust+JS syntax with accessible ASCII aliases. `⇒` means exactly one scoped statement, and semicolons may be left out at parser-proven boundaries. **Feature branch only**; not merged into `main`. Frozen eight-task benchmark and compatibility notes: `docs/M15-SIGN-BLOCKS.md`.

## M16 user-defined symbolic packages (development branch)

A SHA-256-locked `format: 2` package can export actual, pure, typechecked JFH-CODE functions as **user-owned signs** without compiler patches. The `vec.math@1.0.0` fixture defines `⊚` and `⊛` for concrete sequence types; `hcode.m16.lock.json` verifies its exact source and manifest. Full Rust and JS reference tests are under `compiler/tests/m16_packages_v2.rs` and `prototype/test/m16-packages-v2.test.mjs`. See `docs/M16-USER-SIGNS.md` for documented limitations and release criteria. This feature is not merged into main and cannot be claimed as a new 70% source-size result.

## M16.2 experimental ∀-quantified packages

Actual Rust and JS reference frontends support the Unicode type binder `∀T` (secondary ASCII `forall T`) in SHA-locked **format 3** pure libraries. See `packages/poly.signs/lib.hc`, `packages/poly.signs/demo.hc` and `hcode.m16.2.lock.json`. Two user-owned signs `⥇` and `⥈` work for Number, String, Bool and nested typed lists using fresh type inference per call. No unchecked `Any`; old format 1/2 packages and fixed benchmark baselines remain unchanged. Full semantics, security constraints, pending release gates and source-size limitations: `docs/M16-2-UNIVERSAL-SIGNS.md`. Draft feature branch, not merged into main.
