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

The complete H-Code authored program with its four calls contains **258 Unicode codepoints / 273 UTF-8 bytes**. The standalone correctness-oracle TypeScript file includes **3,936 Unicode codepoints / 3,936 UTF-8 bytes**; it handwrites its own parser. Therefore this pair is useful for correctness verification but **is not yet a fair competitive source-compression comparison** against idiomatic TypeScript using maintained CSV and schema libraries. Any future fair external-library baseline must be executed, version-pinned, and report authored adapters/imports and dependency bytes separately.

Do NOT present a raw savings percentage from this self-contained oracle as satisfying the 70% goal. The original M14 68.46% three-case median is unchanged. The canonical global median remains null until all 20 are independently verified, including fairly measured source for each task. No compiler-runtime or dependency-size claim is implied by codepoint counts.

## Integration status

The CSV change is stacked draft PR #29 on #28 and the previous draft chain. It is **not merged into main**. Only exact-head Ubuntu + Windows GitHub Actions success of all Rust, JS, Studio and source-locked tasks may promote functional coverage to **5/20 fully compiler-verified, 0 partial, 15 unsupported**. More than 70% across all twenty remains unproven.
