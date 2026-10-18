# M19.11 — original Markdown heading/link structural processing

## Original immutable preregistration and acceptance

The original 20-task registry remains SHA-locked at Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.
Canonical task **11-markdown-processing** requires **"parse headings/links into deterministic structured output on an agreed fixture"** with `string-processing`, `records` and `markdown-library`.
The original 20 IDs/status labels and 70% all-task target are unchanged.

## Real reusable symbol, no task-specific fixture macro

Core sign `≋` has the ASCII alias `markdown_tokens` and checked signature:

`String → ⟦⦃href:String,kind:String,level:Number,text:String⦄⟧`

A heading token has `kind:"heading"`, `level:1..6`, `href:""`; a
link token has `kind:"link"`, `level:0`, and an href String.
Tokens preserve encountered document order; a heading record precedes
any link records found within its heading text. Headings retain inline
Markdown syntax except for backslash punctuation escapes. Link labels
are unescaped text. There is no HTML rendering or URL execution.

The general library parser is implemented as a **pure language primitive**:
Rust lexer token, parser AST, static checker, typed ESM emitter that only
embeds its parser code when the program uses the sign, plus a separate
independent H-Code JavaScript reference implementation. It works for
different documents, not hardcoded fixture values.

This is a **documented Markdown structural-extraction subset** (not a
full CommonMark/HTML renderer). It implements 1–6 ATX headings, Setext
headings, inline `[title](url)` links including balanced destination
parentheses and Markdown punctuation escapes, HTTP(S) autolinks,
blockquote heading normalization, and excludes fenced/indented code,
inline code spans and images. Reference-style links, HTML anchors,
non-HTTP autolinks and a full Markdown AST are not claimed.

The library caps input to 1 MiB UTF-8, 8,192 lines, 16,384 units per
line, and 4,096 output tokens. When receiving input through `⌨`, the
existing stdin boundary is **stricter: 64 KiB**. Malformed input UTF-8
is rejected by the compiled stdin boundary; host-provided invalid
Unicode surrogate strings are rejected by the pure parser. All emitted
values are safely schema-typed; no filesystem, HTTP or eval capability
is required to parse Markdown.

## Actual frozen source and expected output

| Artifact | Exact Git blob SHA-1 |
|---|---|
| Preregistered 20-task registry | `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` |
| Developer-authored H-Code workload | `e826116ae1f7df4603fad62aee356594c7e58d5f` |
| Independent standalone TypeScript correctness oracle | `b60a9066f1b73c97737e131ebd21b23cd2fbf066` |
| Six fully specified expected-output Markdown fixtures | `754ec2974a3194389ab9e8bf6add038217914fa3` |

Run `npm run benchmark20:verify11`. The verifier executes the
original H-Code workload against **six frozen fixture documents**
and **nineteen generated documents** in:
1. Real Rust compiler → generated Node ESM structural parser;
2. Independent H-Code JavaScript interpreter/reference parser;
3. Standalone separately authored TypeScript correctness oracle.

The test matches exact stdout and JSON structural records in all
three paths and verifies actual frozen expected arrays, not just
engine agreement. Negative tests reject four mistyped source programs
in the Rust typechecker and independent reference, and check malformed
UTF-8 and oversized stdin without partial output. Separate Rust and
JS regression suites check sign/ASCII semantic parity and isolation of
this pure library from unrelated H-Code programs.

`npm run benchmark20:status` must re-run these SHA locks and
acceptance tests before counting task11 fully verified. The original
registry JSON cannot be trivially relabeled, and
`npm run benchmark20:strict` remains incomplete until **all 20**
original tasks pass.

## Real authored source compression and separate runtime costs

| Measurement | H-Code | TypeScript correctness oracle |
|---|---:|---:|
| Unicode codepoints, developer-authored | 19 | 4,103 |
| UTF-8 source bytes, developer-authored | 29 | 4,103 |
| Provisional reduction against correctness oracle (codepoints) | **99.54%** | — |
| Provisional reduction against correctness oracle (UTF-8 bytes) | **99.29%** | — |

These comparisons include the TypeScript parser *in the correctness
oracle*, so they are **NOT** a fair competitive idiomatic maintained-library
TypeScript baseline. The H-Code compiler embeds its own reusable parser
implementation, whose generated JavaScript footprint and SHA-256 are
reported independently by the verifier. That runtime/dependency cost
is **not zero** and cannot be hidden as developer-authored source.
One workload's reduction is **not** proof of the overall >70% goal
across 20 competitive baselines.
