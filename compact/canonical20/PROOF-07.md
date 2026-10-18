# M19.07 — canonical workload 07: real read / transform / atomic write

## Unchanged twenty-task contract

Original SHA-frozen `compact/canonical20/workloads.json` Git blob:
`46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.
The original task 07 requires **read a file, convert content, write destination and verify bytes**, and demands `filesystem-read` plus `filesystem-write`.
All other tasks and original source hashes remain unchanged; 20 tasks stay in the denominator.

## Intrinsic symbol rather than an application macro

The native symbol `⧅` has the ASCII alias `file_write`, with signature
`⧅(filename:String,content:String)→Number` returning exact UTF-8 byte count.
It is a checked effect, not a CSV conversion shortcut.

- **Rust compiler:** native lexer token, parsed 2-argument AST, typechecker
  forbidding usage inside pure packages/functions/sync lambdas, compiled ESM
  emission only if invoked, and no implicit file access from unrelated H-Code.
- **Independent JavaScript interpreter:** synchronous evaluation rejects
  writes; explicit `executeAsync` requires a host-injected fileWrite
  capability and journals committed writes before replaying later HTTP/sleep
  effects. A replayed effect with mismatched input fails closed.
- **Real filesystem backend:** granted with `HCODE_FILE_WRITE_ROOT`
  (absolute, canonical, non-symlink directory); portable basename only;
  rejects `../`, reserved Windows names and invalid Unicode; max 65,536
  bytes per write, bounded total writes and bytes; random exclusive temp
  file, fully written and fsync'ed before atomic `linkSync` no-clobber
  publish. An existing file or symlink is **never overwritten**.
  Node has no portable openat/dirfd: the approved output directory must be
  protected from untrusted rename operations.
- **Existing H-Code primitives:** `⧄` reads from the explicitly
  allowed `data/` project folder, `⧇` parses a typed CSV record,
  and `⤒` serializes a statically validated JSON sequence.

## Original end-to-end conversion source

`compact/canonical20/programs/07-file-conversion.hc` reads a file name
through `⌨`, reads its contents through the existing `⧄`, parses the
`⦃active:Bool,name:String,quantity:Number⦄` CSV record schema, serializes
deterministic typed JSON and creates `converted.json` with `⧅`.
Different CSV inputs exercise the same program; neither the compiler nor
the interpreter contains CSV-to-product-JSON app logic.

## Reproducible exact source and fixture locks

| File | Git blob SHA1 |
|---|---|
| original 20-task registry | `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` |
| developer-authored H-Code | `b93015a0dab3cd5b616026a16348de97162b5bac` |
| independent TypeScript correctness oracle | `8d81d7b3c8150201728d9451dfbd3d07e1359d69` |
| original-style products fixture | `46e536392d088824e261e44a1baf5aa441bcdf3d` |
| Unicode/BOM/CRLF fixture | `508b88528f82cec4b393768f355f87d5aacaa12a` |
| header-only fixture | `f692fb78f747d391f69361885b81ac16c0089bc6` |
| malformed CSV fixture | `222761cc354efa336adce033cb6a04012f825fe0` |

## Actual proof and adversarial security

`npm run benchmark20:verify07` creates isolated temporary filesystem roots
and runs the same frozen H-Code source through **three execution paths**:
real Rust compilation → Node ESM, independent H-Code JS interpreter with
trusted file I/O, and independently handwritten TypeScript correctness oracle.

Tests compare *actual bytes written*, exact stdout reported byte counts,
UTF-8 (including emoji), escaped CSV quotes, header-only output, and
**18 generated variants**, rather than just computing a predicted value.
The six negative malformed CSV datasets must never publish an output.
Separate negative cases reject four incorrectly typed or effectful programs.
The tests also enforce absence of output permissions, no-overwrite, symlink
destination safety, output-size budgets and a replay-once host-write check.
The cross-process atomic publishing race is tested in the Node suite on
both Windows and Linux.

`npm run benchmark20:status` re-runs the SHA-locked proof before deriving
workload 07 as verified; editing a JSON label cannot raise coverage.
`npm run benchmark20:strict` still fails until **all 20** original tasks
have independent proof.

## Character savings, measured honestly

The H-Code source is **173 developer-written Unicode codepoints**. The
TypeScript *correctness oracle* is **3,135 developer-written codepoints**,
giving **94.48% fewer on this one comparison**. The independent verifier
also reports exact authored UTF-8 bytes and the Rust-generated ESM file
size and SHA-256 separately; neither runtime size nor dependencies count
as developer-authored H-Code.

The TypeScript correctness oracle is **not** a fair competitive idiomatic
TypeScript baseline. Neither this individual task's reduction nor the
historical 68.46% three-case M14 median establishes the original 70%
**global twenty-task median**. Remaining tasks cannot disappear from
the denominator.
