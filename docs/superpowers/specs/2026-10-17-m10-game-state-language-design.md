# H-Code M10 — Language-level game state and typed collections

**Status:** Design for owner review; NOT implemented.
**Project:** H-Code, the independent programming language, owned by Jonas Fogh Henneberg / Fastsell.net, Denmark.
**Target branch:** `feat/m10-game-state-language`.
**Date:** 2026-10-17.

## 1. Intent and success criteria

Develop **H-Code itself** so programmers can express real game state in `.hc` source: players, enemy positions, health, bullets, inventories, and movement. Do **not** replace this work with a JavaScript-only engine or a game demo that merely invokes JavaScript functions. The actual syntax, AST, static type checker, and emitter must all understand the new constructs.

M10 is the **language foundation**. M11 may build a browser game runtime (Canvas, input, frame scheduling and audio) on top of it. M12 may build a fully playable H-Code-authored game. M10 does not claim to deliver a game engine.

## 2. Current codebase and design constraints

- Existing public repository: `Henneberg01/H-code`, source in `main`. H-Code has Rust lexer, Pratt parser, AST, checker, and typed JavaScript emitter; a separate JavaScript M1 interpreter supports the earlier language subset.
- The Rust compiler currently accepts `Number`, `String`, `Bool`, `Unit`, and typed functions; AST expressions cover literals, identifiers, operations, unary/binary operations and calls. It has no list literals, record literals, indexing, field access, composite types or complex assignment targets.
- Existing M4 modules export functions and packages with primitive contracts. New record-type exports and the portable browser ABI are distinct compatibility work.
- Maintain the **ASCII and glyph spellings** for existing keywords and operations; do not remove existing `.hc` programs. Do not change Apache 2.0 licensing or H-Code branding.
- H-Code's current `Number` is JavaScript-compatible finite numeric data, not a fixed-point or deterministic multiplayer physics number. Do not promise network determinism or reliable monetary arithmetic.

## 3. Options considered

1. **Expose raw JavaScript objects and arrays as an escape hatch.** Quickest demo, but H-Code would not define game-state semantics or enforce type safety. **Rejected.**
2. **Add native typed lists and named records to the Rust H-Code language, emitting checked JavaScript.** More compiler work, but portable syntax, predictable errors, and a sound foundation for a game runtime. **Selected.**
3. **Begin with WebAssembly and a dedicated native game VM.** Potential long-term option, but introduces an independent backend, ABI and memory model before basic language data structures exist. **Deferred.**

## 4. Proposed language syntax

M10 adds `record` definitions, homogeneous `List<T>` values, property/index expressions and assignment targets, plus two typed list operations. Concrete example (syntax to be implemented, **not currently executable**):

```hcode
record Vec2 {
  x: Number;
  y: Number;
}

record Player {
  position: Vec2;
  health: Number;
}

fn advance(p: Player, dx: Number) -> Player {
  p.position.x = p.position.x + dx;
  return p;
}

let player = Player {
  position: Vec2 { x: 4, y: 8 },
  health: 100
};

let bullets: List<Vec2> = [];
push(bullets, Vec2 { x: 5, y: 8 });
player = advance(player, 2);
print(player.position.x);
print(len(bullets));
print(bullets[0].y);
```

Expected output: `6`, `1`, `8`, each on a new line. If reference semantics for records are chosen, `advance` also mutates the passed record. This design **chooses reference semantics for records and lists**, consistent with JS objects/arrays and convenient for games; `let` binds a mutable reference while `=` rebinds the identifier.

### 4.1 Grammar extensions

- `record <Name> { <field>: <Type>; ... }` at top level.
- `List<Number>`, `List<Bool>`, `List<String>` or `List<NamedRecord>` for variables, parameters, and function return types; nested `List<List<T>>` may be parsed, with explicit test coverage before enabling.
- `let variable: Type = expression;` optional annotation; required when an empty list literal `[]` has no other expected element type.
- `[item1, item2, ...]` homogeneous list literal; `[]` permitted with type context.
- `RecordName { field: expr, ... }` exact-field record constructor (order independent).
- `expression[index]` and `expression.field`, including chains like `enemies[0].position.x`; postfix precedence matches function calls and binds tighter than unary/binary operations.
- Assignment target: mutable `identifier`, list index, or record field, including nested targets; do not accept an arbitrary call or temporary as assignment target.
- `len(list)` returns `Number`; `push(list, value)` mutates a list and returns `Unit`. Both are compiler-typed builtins, not arbitrary JS function imports.
- Existing `if`, `while`, `fn`, `return`, `import`, `use`, glyph aliases and simple assignment must retain their behavior.

### 4.2 Type rules

- `List<T>` is homogeneous and mutable; indexing yields `T`; writing `list[i]` requires a value of `T`.
- List literals infer `T` from members or an expected annotation/parameter type. Mixed types and ambiguous bare `[]` fail at compile time with source locations.
- Named records are nominal types: two differently named records are not interchangeable even with identical fields. Every declared field must be initialized exactly once and with its declared type; unknown, duplicate and missing fields fail at compile time.
- `record` definitions share the top-level type namespace, but are not automatically exported as module types. `M10` retains the existing primitive/signature M4 module ABI; exporting named record types across modules is a separate future compatibility gate.
- `len` and `push` are builtin names. Redeclaring them in conflicting scopes should be rejected consistently with `print` rules.
- Composite records/lists are not equality-comparable in M10; `==` and `!=` work for existing primitive types only. This prevents accidental JS referential-vs-structural ambiguity.
- M10 does **not** introduce `Map`, `Option`, `Result`, generics beyond `List<T>`, property methods, closures or a public FFI.

### 4.3 Runtime and safety semantics

- Lists use contiguous JS arrays; records emit ordinary, compiler-defined objects with no dynamic property keys exposed to H-Code source. M10 should prefer prototype-safe shapes and never emit source text as an executable JS fragment.
- Index expressions must use non-negative integer positions. Out-of-range read/write, noninteger/NaN indices and invalid list targets throw descriptive H-Code runtime errors. No silent `undefined` reads and no JS array-hole extension.
- `push` increases list length by one. `len` returns a list's length; mutation through two references to the same list or record is observable (reference semantics).
- Runtime helpers should be private to generated output. Existing M8 fuel/depth checks remain, including on loop and function execution. These guards **do not create a security sandbox**.
- In M10 `Number` maps to the existing numeric model; no promises about deterministic fixed-timestep physics, multithreaded sync or networking.

## 5. Architecture and file ownership

- `compiler/src/lexer.rs`: `record` keyword and punctuation `[` `]` `.` `<` `>` as needed; preserve original operators.
- `compiler/src/ast.rs`: record declarations, generic type-reference nodes, list/record literal expressions, index/member access, and explicit assignment-target syntax with spans.
- `compiler/src/parser.rs`: type-reference parser, composite constructors, postfix precedence, indexed/member assignment.
- `compiler/src/checker.rs`: `Type::List`, nominal record registry, expected-type propagation, type validation for field/index/push/len and assignment-target mutability. Preserve existing inference for primitives.
- `compiler/src/codegen.rs`: emit checked JS constructors, indexed and property reads/writes, private runtime checks, builtins, and generated identifier mangling.
- `compiler/src/modules.rs` / `compiler/src/packages.rs`: maintain compatibility; do not silently claim exported record types in M10.
- `compiler/tests/m10_game_state.rs`: compile-time rejection tests, H-Code-to-JS output tests, property/list mutation and reference-alias tests.
- `m10/game_state.hc`: complete game-state simulation without browser rendering, encoded in H-Code.
- `docs/LANGUAGE_SPEC.md` and `MILESTONES.md`: version-gate new syntax, document M1 JS reference interpreter limitations; mark M10 complete **only when tests pass**.

## 6. Verification / acceptance gates

1. `cargo test --manifest-path compiler/Cargo.toml` passes M2–M10 Rust tests on a real Rust toolchain.
2. `npm test` retains all 39 M1 JS reference tests; `npm run studio:test` retains existing Studio tests.
3. A new `m10/game_state.hc` program uses H-Code record and list syntax to simulate player movement, health, bullet insertion and indexed update. `hcodec check`, `hcodec build` then Node execution, and `hcodec run` agree on exact output.
4. Negative tests: mixed-type list, untyped empty list, invalid field or record constructor, cross-record mismatch, wrong `push` element, field/index assignment misuse, negative/noninteger/out-of-range index runtime error, incompatible `len` input, invalid nested lvalue, and rejected composite equality.
5. Regression tests: M1 glyphs/ASCII aliases, M4 pure package imports, existing M5 programs, and M8 fuel/depth limits still work.
6. New tests prove the compiler owns the semantics — no H-Code-to-raw-JS escape hatch and no claim of a game engine or browser renderer.
7. Implement on `feat/m10-game-state-language`, open a review PR into `main`. Do not merge until tests are green and the owner approves.

## 7. Out of scope and next steps

- **M11**: browser target and a carefully scoped game host ABI (Canvas rendering, keyboard/mouse/gamepad, asset loading, audio, fixed-timestep loop, collision math). That runtime is not an excuse to avoid M10 language features.
- **M12**: complete playable browser game implemented primarily in H-Code, with tests, assets and frame-time profiling.
- Production sandboxing, server networking, deterministic cross-platform multiplayer, secure package registry, record-type import/export between modules, source maps and cross-platform binaries are separate features.

## 8. Execution approach after approval

Implement M10 in two incremental, test-first slices: (1) typed lists/indexing/`len`/`push`; (2) nominal records, member access, record construction and nested assignment. Each slice requires red/green Rust tests and compatibility runs. Keep the Rust frontend authoritative and use the JavaScript backend only as an output target.
