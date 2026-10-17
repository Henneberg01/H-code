# H-Code M2 — Rust typed frontend

## Scope

M2 is a genuine compiler **frontend**, not yet a compiler backend or replacement runtime. The code is in `compiler/`, organized as:

| File | Responsibility |
| --- | --- |
| `lexer.rs` | Unicode glyph/ASCII canonicalization and located tokens |
| `parser.rs` | Pratt expression parsing and AST construction |
| `ast.rs` | Canonical syntax AST |
| `packages.rs` | Verified M1 offline lockfile and package signatures |
| `checker.rs` | Lexical scope, inference, static constraints and fully typed AST |
| `main.rs` | `hcodec check` and `hcodec ast` developer entrypoints |

## Contract with M1

- Works with existing M1 `.hc` examples and glyph/ASCII spelling pairs.
- All M1 core glyphs lower to the corresponding ASCII token kind.
- `use "name@1.2.3" as alias;` requires a valid, signed-by-hash local lockfile; glyph and `alias::name` link to the same versioned operation id.
- Local package files are checked by SHA-256 and constrained to the lockfile directory; no package source is executed during checking.
- Pure package implementations are typechecked statically; `print`, filesystem and network access are not made available inside pure libraries.
- Function annotations support `Number`, `String`, `Bool` and `Unit`. Missing annotations may be inferred if constraints provide enough information; otherwise explicit annotations are required.
- The `+` operator is valid for Number + Number or String + String; mixed types fail statically.

## M2-specific stricter behavior

- Identifier references must be defined in scope; `return` is forbidden at top level.
- Operators and calls must typecheck, including first-class imported symbol operations.
- A non-Unit function must return on every control-flow path.
- Functions and the `print` builtin may not be reassigned.
- Ambiguous type inference is a compilation error, not a dynamic runtime fallback.
- Plain unannotated functions that depend on concrete use-site types are inferred monomorphically, not implicitly generic.

## Limitations and future work

- The AST is in-memory Rust data, without a stable serialized IR or source map format.
- Only the M1 primitives and first-class function types are covered. No list/map/record, numeric subtypes, generics, ownership, async or effect system exists.
- `Number` is currently the M1 f64-compatible numeric model; overflow and target behavior need precise cross-backend semantics before 1.0.
- M2 does not emit executable code. M3 will compile to JavaScript and compare outputs with the M1 runtime.
- Static analysis and SHA-256 are not an arbitrary-code security sandbox.
- Verified GitHub Actions run results, not the presence of test source files, are the acceptance gate for M2.

## Acceptance

- All M1 Node tests remain green.
- All Rust `cargo test` cases pass on GitHub Actions.
- Real M1 examples pass the Rust static frontend; invalid typed programs fail with source positions.
- The branch and pull request remain separate from `main` until acceptance is reviewed.
