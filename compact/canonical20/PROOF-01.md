# Canonical 01 — true stdin calculator CLI

**Unmodified preregistration:** 01-calculator-cli, original acceptance: **“stdin expressions for +,-,*,/ with invalid division; stable stdout/stderr and exit status”**. Original 20-task registry Git blob SHA: 46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3. No tasks omitted, swapped, or weakened.

## Actual H-Code user source

    print(⩚⌨);

The code is **11 developer-authored Unicode codepoints / 15 UTF-8 bytes** (including newline).

- **⌨ (stdin_text)**: a String-typed *effect* that consumes the host stdin once, at most 65,536 bytes, with fatal UTF-8 validation. Rust statically rejects the effect in pure SHA-verified package code. The reference runtime requires an explicit host callback; Rust hcodec run gives the emitted Node program inherited stdin. No ambient host input is read without a glyph.
- **⩚ (arith_eval)**: pure, statically typed String → Number. A real general-purpose arithmetic parser for finite decimal/exponent numbers, unary plus and minus, parentheses, precedence (multiply/divide before add/subtract), left associativity, division-by-zero and numeric-overflow rejection. Bounded size, steps and recursion depth. No JavaScript eval of user expressions.
- Three independent engines: Rust parser/typechecker/ESM emitter → Node, JavaScript H-Code reference with a separately written precedence-climbing parser, and a standalone TypeScript correctness oracle.
- The CLI contract is exact: valid input returns exit 0, one number and newline on stdout, empty stderr; invalid input returns exit 2, empty stdout and one line with prefix **HCODE_ERROR: ** to stderr.

## Reproducible immutable proof

Run **npm run benchmark20:verify01**. The verifier must prove all of:

1. Exactly **17 immutable successful** arithmetic inputs and **15 immutable erroneous** inputs, with byte-exact stdout/stderr/exit across all three engines.
2. **64 additional, unseen deterministic expression trees** whose results are computed by an independent test generator (not by an implementation's parser).
3. Invalid raw UTF-8 and 65,537 stdin bytes rejected by all three engines, exit 2 and exact stderr.
4. The actual Rust hcodec run CLI must read piped stdin on three representative valid/invalid cases, not just evaluate generated JS directly.
5. Five ill-typed source programs must fail the real Rust typechecker.
6. Native Rust tests of lexer, symbol vs ASCII aliases, typed AST, pure package effect rejection and lazy runtime imports; JavaScript reference tests and exact source SHA anti-edit tests.
7. All existing historical H-Code conformance and canonical benchmarks must remain green on **both** Ubuntu and Windows on the exact PR-head SHA.

Original unchanged Git blob SHA locks:

- registry workloads.json: **46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3**
- cases/01-calculator-cli.json: **ec2a70c7108c5120bbffef22878290a885ecefb0**
- programs/01-calculator-cli.hc: **3acfbc0be6f7902db7aee5dd46ecf0a8eb07a5a6**
- programs/01-calculator-cli.ts: **6bb1ef9a47b77fa9429b560f66faf0e8ced64ca6**

## Benchmark fairness — do not hide runtime work

The standalone TypeScript oracle has **2,365 developer-authored codepoints / 2,365 UTF-8 bytes** and handwrites arithmetic parsing. The arithmetic parser is provided by built-in H-Code runtime code. Thus this raw 11-vs-2,365 comparison is **not yet a fair idiomatic TypeScript with maintained-library benchmark**. A TS dependency-backed alternative needs version pins and full parity tests. Report Rust-generated JavaScript bytes/SHA and dependencies separately. The benchmark excludes generated runtime code from *both* authored code counts, but must not hide or misrepresent runtime cost.

Historical M14 three-case source median **68.46%** remains unchanged, as do other 20-task source locks. On PR #33 after complete successful exact-head cross-platform CI, calculated readiness is **6/20 verified, zero partial, 14 unsupported**, versus 5/20 on main before its integration. The global 20-task median remains undefined; no claim of reaching 70% across all twenty is justified.

PR #33 is draft until its own full CI and review, and does not modify main beforehand.
