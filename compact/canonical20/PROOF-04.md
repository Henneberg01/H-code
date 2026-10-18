# H-Code M19 — canonical task 04: typed CSV and opt-in file access

**Original unchanged acceptance:** parse quoted CSV, reject malformed rows and validate column types deterministically. The original 20-workload registry has Git blob SHA 46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3. Never change a preregistered task's acceptance or treat a status label as execution evidence.

## Real language primitives

~~~hcode
ƒ users(path:String)→String ↩ ⤒(⧇⦃active:Bool,age:Number,name:String,note:String⦄(⧄path));
print(users("canonical04/users.csv"));
~~~

- **⧄ / file_read** is an explicitly effectful String → String file read. On Node, permission is denied by default and requires HCODE_ALLOW_FILE_READ=1. Only regular UTF-8 files inside the project-local data/ root are allowed. Absolute paths, traversal, symlinks, unsafe Windows device names, and files beyond 1 MiB are denied. The static Rust checker prohibits this effect in pure package contexts. The OS process must also be sandboxed for untrusted writers; JS path checks do not eliminate TOCTOU races.
- **⧇ / csv_typed** is a real structural typechecked CSV decoder. Given a concrete record of String, Number and Bool fields, it returns a frozen sequence of null-prototype records. Quoted commas, doubled quotes, embedded newlines, BOM, LF/CRLF and header permutations are supported. Column names must match exactly; duplicate or missing columns, malformed quotes, ragged rows, nonfinite Numbers or values other than lowercase true/false for Bool fail.
- CSV parsing is a pure language operation and is independently implemented by the Rust-compiled JS runtime and the JS reference interpreter. The separate Node file runtime is linked **only** if the program calls ⧄; unused programs do not pay that generated-runtime cost.

The CSV source is bounded by 1 MiB UTF-8, 8,192 data rows, 64 columns and 16,384 characters per cell. Host reference file reading is never implicitly granted to browser or pure verified package code.

## Exact source-locked functional proof

Full command: npm run benchmark20:verify04. The gate checks original workload ID, acceptance, source and input-file SHA locks; then runs the actual Rust H-Code compiler → generated Node ESM, the independent H-Code JS reference and a standalone TypeScript correctness oracle.

The proof requires:
1. Four unchanged valid CSV files with the full source program's exact stdout in all three engines, covering escaped quotes, embedded commas/newlines, reordered headers, Unicode, BOM/CRLF and header-only input.
2. Six malformed byte-frozen CSV inputs rejected by all engines.
3. Forty reproducibly generated CSV files with different schemas' column order, values, Unicode and quoting, with independently constructed expected records.
4. Five invalid H-Code typing sources rejected by Rust and the JS reference.
5. Denial of file access without an explicit opt-in, rejection of traversal and unsafe absolute/device names; an additional Rust test blocks effects in pure packages.
6. The same SHA-frozen original twenty-workload corpus; no extra easy twenty-first task, and all other unsolved workloads remain in the denominator.

All byte-exact CSV fixtures are protected from Windows Git autocrlf conversion by data/canonical04/*.csv -text in .gitattributes. Generated Node JS bytes and SHA-256 are measured separately from developer-authored source.

## Correctness oracle versus idiomatic source-size baseline

The complete H-Code authored program with its four calls contains **258 Unicode codepoints / 273 UTF-8 bytes**. The standalone correctness-oracle TypeScript file includes **3,936 Unicode codepoints / 3,936 UTF-8 bytes**; it handwrites its own parser. Therefore this pair is useful for correctness verification but **is not yet a fair competitive source-compression comparison** against idiomatic TypeScript using maintained CSV and schema libraries. A **separately SHA-locked and version-pinned idiomatic TypeScript comparator is now implemented** in `compact/canonical20/baselines/04-idiomatic-typescript/` (see below); the 3,936-character handcrafted TS oracle remains a separate correctness control.

Do NOT present a raw savings percentage from this self-contained oracle as satisfying the 70% goal. The original M14 68.46% three-case median is unchanged. The canonical global median remains null until all 20 are independently verified, including fairly measured source for each task. No compiler-runtime or dependency-size claim is implied by codepoint counts.

## Integration status

The native CSV implementation, its Rust/JS conformance tests, and the original case-04 proof **were merged to `main` in PR #30**. PR #31 enabled Windows/Linux CI on every `main` push. The additional standalone maintained TypeScript comparator is a **separate draft PR #32**, to be merged only after both OS checks pass. Coverage remains **5/20 fully verified, 0 partial, 15 unsupported**. The global median is not computed and 70% overall is not proven.

## Independent maintained-library TypeScript baseline (PR #32)

This comparator is **not** the original self-written TS correctness oracle. Instead it uses real, maintained, locked libraries: `csv-parse@7.0.2` for quoted CSV and `zod@4.6.5` for strict, typed record validation. Both exact NPM tarball integrity values (SHA-512 SRI) are checked in a dedicated `package-lock.json`; `npm ci --prefix compact/canonical20/baselines/04-idiomatic-typescript` installs dependencies under that subdirectory only.

The benchmark's full user-authored TypeScript is **both files**: `reader.ts` (typed CSV parsing, data-root filesystem access, validation and imported packages) plus `program.ts` (four original file calls). No code, import, security guard or schema declaration is omitted from the source count.

| Metric | H-Code original | Maintained-library TypeScript comparator | Reduction |
|---|---:|---:|---:|
| All developer-written Unicode codepoints | **258** | **3,362** | **92.33% fewer** |
| All developer-written UTF-8 bytes | **273** | **3,362** | **91.88% fewer** |
| Installed `csv-parse` tree (Linux, library + declarations) | — | **1,606,924 bytes, 33 files** | separate footprint |
| Installed `zod` tree (Linux, library + declarations) | — | **6,140,311 bytes, 840 files** | separate footprint |
| Separate package metadata | — | **335 bytes manifest / 879 bytes lock** | separately listed |

**Verification:** `npm run benchmark20:csv-idiomatic` checks all four original positive and six malformed CSV files, 40 deterministic additional CSV datasets, fail-closed filesystem access and unsafe path rejections, pinned original H-Code/registry/TS oracle sources, exact library versions, immutable lockfile SRI and execution of the real `.ts` program using Node 22 type-stripping. A dedicated workflow installs these packages and runs this verifier independently on Windows and Linux, in addition to the unchanged Rust/JS/original TS compiler proofs. All authored source and separately installed package bytes are logged machine-readably. Run the install step **before** the idiomatic verifier.

**Interpretation:** This gives a **better task-level library comparison** than counting a handmade TS parser, while acknowledging the TS baseline includes manual filename safety checks and schema conversion that H-Code implements in its native compiler/runtime. H-Code generated JS size, Rust compiler/toolchain bytes and dependency tarball compressed bytes are different metrics, not deducted from source-length numbers. No `tsc --noEmit` strict static typecheck, timing or runtime throughput comparison is included at this stage. The TS package-footprint data are *installed tree sizes*, not bundle sizes.

**It is one of the original 20 only.** A 92.33% saving on workload 04 does **not** make the global 20-task median 92.33% or validate the overall 70% target, because 15 original tasks still lack full proof.
