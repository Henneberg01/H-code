# H-Code language specification - M1 draft (0.1)

> **Normative status:** DRAFT. Only the subset flagged `reference implemented` is executable. The reference frontend is written in JavaScript to validate semantics quickly. It is not the intended future optimized compiler.

## Goals

H-Code is a general-purpose language with a readable textual spelling and a compact symbolic spelling. A glyph is an alternative notation for a well-defined semantic operation, **not** a magic replacement for hundreds of missing lines. The M1 reference implementation already links user-defined operations to imported, typed, version-locked local libraries.

The language is independent of FastSell or any platform. For M1 its reference program runs in Node.js. Web, server, native, desktop, mobile and games are future target/library combinations, not presently shipped functionality.

## Source representation

- Source encoding: UTF-8; normalize text to NFC when read by reference frontend.
- M1 names: ASCII `[A-Za-z_][A-Za-z0-9_]*`; non-ASCII identifiers remain a later design decision. Core glyphs come from a fixed table; user glyphs are single Unicode symbol codepoints resolved only through explicit package imports.
- String literals: double-quoted with `\\n`, `\\t`, `\\r`, `\\"`, and `\\\\` escapes.
- Numeric literals: base-10 integers and decimals; the reference frontend uses JavaScript Number, so arbitrary precision, integer overflow, NaN and floating-point rounding are **not** stable language semantics yet.
- Whitespace: insignificant outside quoted strings.
- Statements: always end with `;`, except function declarations and control-flow blocks. There is no implicit semicolon insertion.
- Comments: `//` line comments and `/* ... */` non-nested block comments.
- Forbidden in M1: default-ignorable Unicode codepoints, ASCII control characters except common line breaks/tabs, and bidirectional controls to limit invisible syntax manipulation.
- Core glyphs and their ASCII forms lower to identical token kinds. User glyphs are linked to canonical library operation references; glyph and qualified textual calls have identical **linked ASTs**. Unknown and ambiguous glyphs are rejected during linking.

## Statements (reference implemented)

```
let name = expression;
name = expression;
fn name(arg, typed: Number) -> Number { return expression; }
use "package.name@1.0.0" as alias;  // only at top level
if (condition) { statements } else { statements }
while (condition) { statements }
return expression;
expression;
```

- `let`: immutable *declaration site*, but the declared binding can currently be reassigned with `=`. This is an experimental **mutable binding** semantics; final const-vs-var design is open.
- Blocks create lexical scopes; redeclaration in the same scope is a runtime error in the reference version. A new declaration in a nested scope shadows the outer declaration.
- Function declaration captures lexical scope. Calls check argument count, and recursion works.
- `return` exits a function; compile-time rejection of top-level `return` is still planned.
- `if` and `while` accept only Boolean conditions; truthy/falsy coercion is not permitted.
- M1 optional type annotations on parameters and return types are **parsed but not statically enforced**. Full static checking belongs to M2.
- Builtin `print(value, ...)` writes output; this is a provisional I/O boundary, not a permanent universal effect system.
- `while` is bounded by a reference-interpreter execution-step limit for development safety. It is not a security sandbox.

## Expressions (reference implemented)

Literals: Numbers, Strings, `true`/`false`; identifiers; parenthesized expressions; calls; unary `-` and `not`; binary arithmetic, comparison, equality, `and` and `or`. Only `String + String` concatenation is allowed; arithmetic operators otherwise require numbers. Division by zero is an error. Boolean operators short-circuit and require Boolean operands when evaluated.

Operator precedence from low to high:

| Rank | Operators | Association |
|---|---|---|
| 1 | `or` (`∨`) | left |
| 2 | `and` (`∧`) | left |
| 3 | `==` (`≡`), `!=` (`≠`) | left |
| 4 | `<`, `>`, `<=` (`≤`), `>=` (`≥`) | left |
| 5 | `+`, `-` | left |
| 6 | `*`, `/`, `%` | left |
| 7 | unary `-`, `not` (`¬`) | right |
| 8 | function call `f(x)` | left/postfix |

Equality is currently strict value equality for same primitive runtime type in the M1 reference implementation. Structural equality of user-defined records is not specified yet.

## Type design (partially enforced for M1 library contracts)

Types: `Number`, `String`, `Bool`, `Unit`, `List<T>`, `Map<K,V>`, `Option<T>`, `Result<T,E>`, user-defined records, and typed functions. Decide on `Int` vs `Float` versus arbitrary precision prior to M2. Static typing should reject argument type mismatch, invalid operators, misuse of results, and unknown modules without running the program.

## User symbols and locked libraries (reference implemented)

M1 now includes an **offline reference implementation** of user-defined, pure, typed operation symbols. A package author writes ordinary H-Code functions, then exports them through a `manifest.json` specifying the glyph, canonical name, explicit input/output types, package version, and `effects: []`. The importer pins exact manifest and library-source SHA-256 digests in `hcode.lock.json` and explicitly imports a package:

```hcode
use "demo.math@1.0.0" as math;
print(⊕(20, 22));        // 42
print(math::add(20, 22)); // 42
print(math∷⊕(5, 6));     // 11
```

In the linker, each spelling produces the same `OperationRef {id: "demo.math@1.0.0::add"}`; the corresponding H-Code library source defines the implementation. The operation is never automatically available without an explicit import.

### M1 supported contract semantics

- Library manifests and source must match the pinned SHA-256 hashes and package identifier/version.
- Each exported function's annotated `Number`, `String`, `Bool` or `Unit` parameter and result types must agree with the manifest contract.
- Obvious literal mismatches and direct-call arity errors are rejected during linking; dynamic parameter types, first-class operation calls and return values are checked at runtime. Full static checking remains M2.
- Only `effects: []` is supported. Library functions execute in their own scope without ambient builtins or host capabilities. This does not constitute an arbitrary-code security sandbox.
- If two imported packages expose the same bare glyph, linking fails and requires a qualified reference such as `math::add`.
- Core symbols and reserved future symbols cannot be overridden. Custom glyphs must be single Unicode category-S codepoints stable under NFC and NFKC.
- Package source and manifest are local files; no registry/download or JS extension execution is implemented.

The complete manifest format, creation walkthrough and security caveats are in [`docs/LIBRARIES.md`](./LIBRARIES.md). The exact v1.0 package ABI, generic types, signature verification, capability system, macro hygiene and transitive dependency resolution remain **open future designs**; the current offline M1 manifest is experimental.

## Error handling and portability (planned)

- Diagnostics must include path, line, column, offending token and contextual suggestions.
- Control flow and type checking must not depend on hidden AI decisions.
- Define portable observable behavior before adding JavaScript, Wasm or native code generation.
- Define a capability/security policy for operations that access filesystem, network, environment, subprocesses or credentials.
- Add golden conformance tests and versioned spec releases before 1.0.

## Explicit limitations

The executable M1 prototype does **not** support records, arrays, general modules, online package downloads, full static typechecking, arbitrary effectful user operations, foreign-function imports, async, source maps, WebAssembly, mobile apps, graphics, or a secure runtime sandbox.

**Unresolved decisions:** numeric model, ownership/lifetimes, errors (`Result` vs exceptions), generics, import syntax, overloading, compile-time macros, async, native runtime and ABI stability. These must be settled or version-gated before production use.


## M19 experimental sign-first data and ordering extensions (not M1)

**Typed database table projection:** `⧈⦃field:Type,...⦄(db,table)`
uses a distinct Rust AST for two-operand, read-only relational projection
of named String, Number or Bool SQLite columns. All requested field names
must be safe identifiers. Actual SQL is a **generic backend detail** and
is not handwritten H-Code. The existing three-operand `⧈(db,sql,params)`
syntax remains as a low-level, bounded, parameterized SQL escape hatch.
Both forms require the same explicitly granted database read effect and
return fully typed sequences of records; unknown fields, data type
mismatch and SQL-looking table names fail closed.

**Comparison semantics:** for typed operands `a` and `b`, `a<b`,
`a>b`, `a≤b` and `a≥b` accept matching finite Number operands or
matching String operands. String ordering is lexicographic by Unicode
scalar code points, not locale collation or JavaScript UTF-16 code units.
Mixed String/Number or Bool comparisons are static type errors. UTF-8
byte counts and source-code character counts remain separate metrics.

These are candidate language semantics on a development branch and do
not alter the original M1 prototype contract or SHA-frozen benchmark
source files. See docs/H-CODE-SIGN-FIRST-REMEDIATION.md for proof gates.
