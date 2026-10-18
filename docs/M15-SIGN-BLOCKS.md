# M15 — Symbolic short blocks and unambiguous delimiter elision

**Branch:** `feat/m15-sign-blocks-delimiters`, stacked on M14 draft PR #13. **Not merged to `main`**.

## Design goal

H-Code's fundamental purpose is **a compact, general-purpose, typed language whose primary grammar is meaningful symbols**. M15 eliminates punctuation where the parser can prove a statement boundary and adds a one-sign control-body form. All source is still ordinary deterministic H-Code: no search-and-replace macros, opaque AI or task-specific shortcuts.

## New canonical tokens

| Primary sign | Accessible alias | Meaning |
|---|---|---|
| `⊢` | `if` | Execute a Bool-guarded branch |
| `⊣` | `else` | Alternative to the nearest eligible `⊢` |
| `⟳` | `while` | Re-evaluate a Bool guard before each iteration |
| `⇒` | `=>` | Exactly one ordinary statement as a control body |

The four signs are NFC/NFKC-stable, reserved against symbol-package collisions and lex as the **same real token kinds** as their aliases in Rust and JS. They are listed in the Studio palette.

## Grammar and semantics

```ebnf
ifStmt      := ("⊢" | "if") "(" expression ")" body [("⊣" | "else") body]
whileStmt   := ("⟳" | "while") "(" expression ")" body
body        := "{" statement* "}" | ("⇒" | "=>") statement
terminator  := ";" | EOF | "}" | endOfPhysicalLine | distinctStatementStart
```

The optional terminator rule applies **only after a syntactically complete statement**. A physical newline can end a statement when the next token cannot extend its parsed expression. For example, `≔x←2\n+3` is one expression with value 5, not two separate statements. No newlines are inserted as expression tokens.

`distinctStatementStart` is the finite token set `ƒ/fn`, `≔/let`, `↩/return`, `⊢/if`, `⟳/while`, `use`, `import`, `export`, `⊣/else`. Adjacent ordinary calls such as `print(1)print(2)` **remain invalid**; they require a newline or semicolon. `⊣` is only valid after an `if` branch and attaches to the nearest eligible `if` as in the original brace syntax. Use braces for multi-statement bodies and to disambiguate nested alternatives.

A short `⇒` body has **exactly the same AST and lexical scoping** as a brace-wrapped one-statement body. All existing effect, static Bool checking, scope, return, arithmetic and security constraints are preserved. Normal `{...}`, `;`, `if`, `else`, `while` remain valid. `⇒` is **not** a JavaScript arrow or an alternative H-Code function-return keyword.

## Executable sign examples

```hcode
≔n←0⟳(n<3)⇒n←n+1
print(n)
```

Output `3`.

```hcode
ƒsign(n){⊢(n<0)⇒↩"negative"⊣⇒↩"nonnegative"}
print(sign(-5))
```

Output `negative`.

```hcode
ƒtwice(n)↩n*2≔v←21
print(twice(v))
```

Output `42`. The boundary between `↩...` and `≔...` is statically unambiguous even on one line.

## Benchmark provenance and measurement gates

The exact **eight frozen M10 tasks** and their idiomatic TypeScript source SHA-1 Git blobs are retained untouched. New M15 versions are saved under `compact/benchmarks/m15/`, separately SHA-locked in `manifest.json`. All eight original task IDs, acceptances and stdout are retained.

Run `npm run m15:measure` on Node22+ and Rust stable: it validates **all 24 source SHA hashes**, executes original M10 and new M15 source through the **actual Rust-to-JavaScript compiler** and TypeScript through real Node, fails on differing stdout, and reports code points/UTF-8 bytes separately.

This eight-task improvement cannot be compared to the three-task M13/M14 medians as if both were the same population. It is **not** the full 20-task benchmark; that remains in M19/M58. Dependencies, AI tokens and runtime performance are not measured here.

## Acceptance

- [x] Tokenizer/parser source implementations authored in both Rust and JS.
- [x] Pure implementation source and matched sign/ASCII/negative tests authored.
- [x] Eight M10 tasks rewritten in compact signs; original TS and M10 sources SHA-pinned.
- [ ] Complete GitHub Rust/Node/Studio CI on the final M15 SHA.
- [ ] Fully validated `npm run m15:measure` output from actual compiled sources.
- [ ] Review, integration into stacked PR chain and release; main unchanged.

An **M15-green workflow does not mean the global goal of 70% shorter across all 20 programs has been achieved**.
