# H-Code

**H-Code** is an experimental typed, symbol-first programming language inspired by Morse-code-style information density: a real Unicode sign can stand for a precise, reusable, typed operation. The glyph is actual compiler-recognized source syntax, **not** a visual replacement for JavaScript. ASCII aliases are secondary accessibility spellings with the same semantics. H-Code is an independent project, not a FastSell platform feature.

Copyright © 2026 **Jonas Fogh Henneberg**, operating as **Fastsell.net** (CVR **46614887**), Denmark.

**Project identity and durable language rules:** [H-CODE-PRINCIPLES.md](H-CODE-PRINCIPLES.md). Signs are source code — never only visual shortcuts.

## Write H-Code with real signs

These are executable H-Code programs using the same imported typed operation:

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

Requires Node.js **20+** and the stable Rust toolchain. In the repository root:

```sh
npm test
cargo test --manifest-path compiler/Cargo.toml
npm run studio:test
cargo run --manifest-path compiler/Cargo.toml -- run examples/hello_ascii.hc
npm run studio
```

Studio runs at **http://127.0.0.1:4317/** on the local computer. It can open, save, check, build and run H-Code. It also supports reviewed AI code-edit proposals, optionally generated using a separately billed OpenAI API key. Using a ChatGPT subscription does not pay for the API.

## Features

- **M1:** JS reference interpreter, user-defined glyph libraries, SHA-256-locked packages.
- **M2:** Rust lexer/parser and static type checking.
- **M3:** typed H-Code to JavaScript compilation; `hcodec build` and `hcodec run`.
- **M4:** local `.hc` modules, explicit function exports and starter math/text library.
- **M5:** invoice, inventory and savings calculation demos (not complete production apps).
- **M6:** H-Code Studio local web editor.
- **M7:** model-assisted structured edits with diff review and explicit approval.
- **M8:** basic loop and recursion limits and local HTTP safeguards — **not** a sandbox.
- **M9:** beta staging and governance, **not yet a public release**.

## Symbol compactness: measurements, not promises

Four equivalent programs reduced Unicode code points by **11.39–18.92%** but UTF-8 bytes by only **0–5.88%**. The 70% smaller code, 2–5× developer speed and 25% fewer AI tokens are research targets **not yet verified**. Run `npm run phase1:test` and `npm run phase1:measure` for reproducible evidence. See [raw data](phase1/results/source-metrics.json) and [measurement policy](docs/BENCHMARKS.md). Runtime speed and AI tokens were **not** measured by this compactness experiment.

## License and commercial offering

Source in this repository is licensed under **Apache License 2.0** (see LICENSE/NOTICE). You can redistribute and use it commercially subject to that license. The official H-Code name and logos are governed separately by TRADEMARKS.md. Future H-Code Studio Pro/Cloud offerings may be sold under separate terms, while Core remains free (COMMERCIAL.md).

## Security and limitations

**Only run H-Code from trusted authors.** Generated JavaScript has Node.js host privileges and is not isolated. Studio should never be exposed to the public network. There is no production readiness or measured superiority claim; see SECURITY.md and docs/M9_STATUS.md.

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
