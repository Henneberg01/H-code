# Canonical M19 workload 02 — real typed Fibonacci recursion

**Exactly the original preregistered task:**
- ID: `02-fibonacci-recursion` (order unchanged, registry Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`)
- Acceptance: `input n=7; stdout 13; recursion and type equivalence against fixed TypeScript baseline`.
- Historical M10 original source Git blobs: H-Code `66f02e2dce678b51f8d02766742d9d24aa5d66f7`, TypeScript `2a4e6ac1ef469a6e0c64381b79f901ee26085125`.
- Additional fixture `compact/canonical20/cases/02-fibonacci-recursion.json` is SHA-pinned and includes a deterministically recomputed iterative oracle, **16 legal n values** including 7, and **3 illegal typing** cases.

## Honest codepoint regression on the original fixed M10 source

```hcode
ƒ fib(n: Number) → Number {
  if (n ≤ 1) { ↩ n; }
  ↩ fib(n - 1) + fib(n - 2);
}
print(fib(7));
```

Compared to its frozen, idiomatic TypeScript typed recursion:
```ts
const fib = (n: number): number => n <= 1 ? n : fib(n - 1) + fib(n - 2);
console.log(fib(7));
```

| Original source size | H-Code | TypeScript | Result |
|---|---:|---:|---|
| Unicode codepoints, including calls | **96** | **94** | **H-Code 2.13% longer** |
| UTF-8 bytes | **105** | **94** | **H-Code 11.70% more bytes** |

This regression must never be dropped from the 20-task findings, nor hidden by changing the frozen M10 file.

## A separately SHA-frozen, shorter H-Code authoring candidate

The compiler already supports a shorter equivalent symbolic version using **native H-Code constructs**, not a macro hardcoded to Fibonacci. It replaces a multi-line conditional and two return statements with **one real typed conditional expression**:

```hcode
ƒ fib(n:Number)→Number ↩ n≤1?n:fib(n-1)+fib(n-2);print(fib(7));
```

- Separate reviewed source path: `compact/canonical20/candidates/02-fibonacci-glyph-first.hc`, Git blob `9f60ca57fec6dd77c1b4ee358913224e860b140c`.
- **64 H-Code developer-written Unicode codepoints / 71 UTF-8 bytes**, compared to the **same original** 94 TS codepoints/bytes: **31.91% shorter** by Unicode codepoint count and **24.47% fewer bytes**.
- **Not a replacement for the M10 historical baseline:** the verifier reports *both* versions and requires identical real output across 16 inputs on Rust compiled JS and independent JS reference for the compact candidate.

## Acceptance and safety

Run `npm run benchmark20:verify02`. The checker must:
1. Verify the original preregistry, eight-case M10 manifest, M10 baseline, the two original program source blobs, the separate candidate source, and the new fixtures by exact Git blob SHA.
2. Produce exactly **13** for the frozen original input n=7 in the Rust H-Code compiler→Node JS, independent H-Code JS reference interpreter, and original TypeScript Node runtime.
3. Execute a range of **16 different n values**, checked against a separate iterative Fibonacci oracle. All 3 paths must agree. This prevents merely hardcoding a result for n=7 or relying on a pre-generated output string.
4. Compile and execute the symbol-first candidate with real Rust output on n=7 and across all 16 values; the JS reference must also match the same oracle.
5. Reject **3 statically ill-typed H-Code programs** (string argument, boolean argument, wrong function return type) in the Rust compiler and the reference runtime/interpreter.
6. Fail immediately if any comparison or SHA lock changes. Verify generated JS artifact sizes separately from developer-authored source.

TypeScript has explicit **n:number → number** annotation and was executed for all 16 values, but **standalone tsc --noEmit was not measured**; do not overstate TS compiler verification. No external libraries or authored package source are hidden for this workload. Runtime performance, compiler speed and dependency sizes are not yet measured.

### Global accounting

After success, task 02 may move from **partial** to **fully compiler-verified** in the **derived** report without changing the original SHA-frozen registry JSON. Together with independently verified task 05 this makes **2/20 full, 1 partial (task 10), 17 unsupported**. The original M14 historical three-task median **68.46%** remains separately verified; task 05's 70.37% is also separate. The global median remains `null` until all 20 are verified.

Branch-only stacked draft PR #26. The dependent PR #25 and earlier stack must be reviewed and merged in order; `main` is unchanged.
