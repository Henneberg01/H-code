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

The standalone TypeScript oracle has **2,365 developer-authored codepoints / 2,365 UTF-8 bytes** and handwrites arithmetic parsing. The arithmetic parser is provided by built-in H-Code runtime code. Thus the raw 11-vs-2,365 comparison is **not used as a competitive source benchmark**. PR #34 adds a separate, exact-source-pinned maintained-expression-library TypeScript comparison with its own full fixed/variable-input CLI and security gates. Report Rust-generated JavaScript bytes/SHA and dependencies separately. The benchmark excludes generated runtime code from *both* authored code counts, but must not hide or misrepresent runtime cost.

Historical M14 three-case source median **68.46%** remains unchanged, as do other 20-task source locks. PR #33 is now **merged to `main`** after successful cross-platform CI, yielding **6/20 verified, zero partial, 14 unsupported**. The global 20-task median remains undefined; no claim of reaching 70% across all twenty is justified.

PR #33 was merged to `main` at `3affdd0ab47e155e37de459be35fa94603f7b193`. PR #34 only adds a separate library-backed benchmark; no compiler or canonical input changes.

## Lockfile-based maintained TypeScript expression-library baseline — PR #34

This baseline is **separate** from the source-frozen self-written TypeScript oracle. A real published mathematical expression parser `@expr-eval/js@3.7.0` is imported into one complete TypeScript CLI program at `compact/canonical20/baselines/01-idiomatic-typescript/program.ts`. It implements the *same original acceptance*: numeric literals, unary plus/minus, parentheses, correct + - * / precedence, stdin UTF-8/size checks, deterministic stdout/stderr/exit code, nonfinite results and division-by-zero errors. It refuses identifiers, implicit multiplication, member access and all other operators and **never** calls `eval` or `toJSFunction`. The older, unmaintained `expr-eval@2.0.2` package is deliberately not used due to known published security issues.

The NPM dependency and tarball integrity are exact: `@expr-eval/js@3.7.0`, package-lock Git SHA `cf3d71a3eb58ffb60ae4d525624219a0598166ad`, SHA-512 SRI `sha512-bt6N4klnRt6sfhVSI1TyM5fO0l9xIV5ofXpuk2a/GlpgyHZkkUiUSYNMf3FURABCWPbehlHWzvqX35teSgA1TA==`. It is installed isolated under the comparator directory, never in the root production package.

| Metric | Original H-Code | New maintained-library TypeScript | Difference |
|---|---:|---:|---:|
| **All authored Unicode codepoints** | **11** | **2,786** | **99.61% fewer** |
| **All authored UTF-8 bytes** | **15** | **2,786** | **99.46% fewer** |
| `@expr-eval/js` installed directory (Linux) | Built-in H-Code runtime | **121,201 bytes / 31 files** | Separate dependency |
| Published package metadata/lock | H-Code platform separate | **212 / 704 bytes** | Separate metadata |
| Rust-generated H-Code JS output | **6,255 bytes** | TS runtime/bundle not similarly measured | Separate runtime |

Run `npm ci --prefix compact/canonical20/baselines/01-idiomatic-typescript --ignore-scripts --no-audit --no-fund`, then `npm run benchmark20:calc-idiomatic`. This comparator passes all **17+15 frozen** input cases with exact output/error and exit code, plus **64 deterministic extra inputs**, raw invalid UTF-8, 65,537 input bytes and forbidden expression syntax. It must also pass the SHA-lock anti-cherrypick test and complete Windows/Linux CI. Compiler runtime speed and bundle-size parity, isolated strict `tsc --noEmit`, and dependency compressed-tarball size **have not been measured**.

This is a measured result on only **one of the 20 original tasks**, not the global median. The source size gain is large because H-Code's `⩚` standard runtime already contains the arithmetic parser, whereas TypeScript calls an external maintained library and still explicitly guards accepted grammar. Both runtime and dependency costs must remain visible, and no overall 70% claim follows. The global source median is still `null` until 20/20 are valid.
