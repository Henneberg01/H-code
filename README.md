# H-Code

**H-Code** is an experimental typed, symbolic programming language. Unicode glyphs and their ASCII spellings can identify the same operations. H-Code is an independent project, not a FastSell platform feature.

Copyright © 2026 **Jonas Fogh Henneberg**, operating as **Fastsell.net** (CVR **46614887**), Denmark.

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

## License and commercial offering

Source in this repository is licensed under **Apache License 2.0** (see LICENSE/NOTICE). You can redistribute and use it commercially subject to that license. The official H-Code name and logos are governed separately by TRADEMARKS.md. Future H-Code Studio Pro/Cloud offerings may be sold under separate terms, while Core remains free (COMMERCIAL.md).

## Security and limitations

**Only run H-Code from trusted authors.** Generated JavaScript has Node.js host privileges and is not isolated. Studio should never be exposed to the public network. There is no production readiness or measured superiority claim; see SECURITY.md and docs/M9_STATUS.md.

## Release and contributing

Read docs/RELEASING.md and CONTRIBUTING.md. Run `npm run release:check` when preparing a candidate. The GitHub Actions workflow is manual-only to prevent unplanned Actions credit usage.
