# Canonical14 — complete persistent todo application, B2/B3 evidence

## Original acceptance is immutable

The original preregistered workload `14-todo-app` requires **add/complete/remove with persisted state and accessible UI updates**, with capabilities `dom`, `ui-events`, `persistence`. We **do not** modify `compact/canonical20/workloads.json` (frozen Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`) or weaken its acceptance. A derived checker can count task14 only after its actual multi-engine/real-browser proof passes.

Original source locks for the implementation and independently authored comparison:

| File | Immutable Git blob SHA |
|---|---|
| `compact/canonical20/programs/14-todo-app.hc` | `2931b75caac9db0582e0d8088fe2f1e29f5cd934` |
| `compact/canonical20/idiomatic/14-todo-app.ts` | `d3ca8ac09a9c0a6d830fd559b4aaf0f36ead8bad` |
| `compact/canonical20/programs/14-todo-app.html` | `8b1865443f5b1eeafb8e678e1c56c13ab0092dc4` |
| `scripts/m19-todo-browser-probe.js` | `65ac2bda0d9a7ca4b0d10f3cbf43b1764f79660d` |

## Architecture: source-authored app, general language only

The standalone H-Code program uses user-authored typed JSON record lists, filter `⌕`, map `⇢`, sequence append `⧺`, serialization `⤒`, typed JSON parse `⤓`, bounded Unicode character validation `⫶`, real browser DOM events `⟓`, safe `⟐/⟑` DOM access, safe semantic `⟘` list rendering and real persistent `⟕/⟖` storage.

**No built-in todo operation exists.** The new general-purpose `⟘` `dom_list(String,⟦String⟧)→Unit` creates actual `<li>` DOM nodes using `textContent`; it accepts only `<ul>`/`<ol>` elements, validates at most 1024 UTF-8 bounded string items, and never interprets HTML. The symbol is checked in Rust and implemented independently by H-Code's JavaScript reference interpreter.

The HTML document provides a labelled task-name input, three keyboard-accessible native action buttons, a semantic live `<ul>` and screen-reader-friendly status/summary regions. Task title is its exact identity; repeated titles are rejected rather than silently added. A title is bounded to 128 Unicode code points and must contain a non-ASCII-whitespace character. The app does not implement authentication or encryption (browser localStorage is origin-scoped and accessible to origin scripts).

Persistent state is a typed JSON array of `{title:String,done:Bool}`. On each successful operation the **new state is written before mutable app state changes and DOM re-render**, so rejected browser storage writes do not falsely display success. A corrupt stored JSON value fails closed during typed parsing; the app does not silently overwrite it.

## Independent three-engine acceptance

1. `cargo test --manifest-path compiler/Cargo.toml --test m19_todo_ui`: native compiler validates complete developer-written H-Code program, generic list signature/alias, wrong types and exclusion from pure signed package contexts.
2. `npm run m19:todo-ui`: Rust-generated browser ESM and independent JavaScript H-Code interpreter use separate injected DOM/storage hosts; both add, complete, remove, reject duplicates and empty input, render inert HTML text and reload stored state with identical effect results.
3. `npm run m19:todo-chrome`: **two fully independent applications** (the actual Rust-generated H-Code browser ESM and ordinary idiomatic TypeScript) are each executed by headless real Chromium. A neutral browser probe performs **15 stages over three separate browser processes**, using the same browser profile and local origin for each application's persistence. It checks logical stored JSON, actual `<li>` elements, keyboard-compatible click event default cancellation, live regions, duplicate/error feedback, HTML injection as inert text, Unicode, completion/removal and storage surviving two full process restarts. Both engines must yield byte-equivalent browser trace JSON after normalizing only JSON object key order.
4. `npm run benchmark20:verify14`: validates all **Git-blob source locks**, original workload contract and capabilities, then actually reruns the native compiler test, JS interpreter and real Chrome/TypeScript comparison as child processes. Rejects skipped tests, failed browser traces, missing metrics and source drift. Only this gate may derive `14/20` in `scripts/canonical20-coverage.mjs`.

## Fair authored source and runtime footprint

| Measurement | H-Code | Independent idiomatic TypeScript |
|---|---:|---:|
| Developer-written Unicode codepoints | **1,456** | 1,999 |
| Developer-written UTF-8 bytes | **1,757** | 2,003 |
| Codepoint reduction | **27.16%** | — |
| UTF-8-byte reduction | **12.28%** | — |
| Rust-generated H-Code browser ESM bytes | **18,213** | Compare separately, not source |

This app does **not** meet the H-Code 70%-fewer-source-codepoint goal. The original 20-task global median remains uncomputed until 20/20 equivalent independent proofs. We must **improve general symbol-level expressiveness and real reusable collection operations**, not inflate TypeScript or introduce task-specific magic glyphs.

**B2/B3 merge gate:** exact-head Windows and Ubuntu native/compiler/proof, real Chromium and CodeQL all green; original registry unchanged. `main` remains at **13/20** until merged and verified.
