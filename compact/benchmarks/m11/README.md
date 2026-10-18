# H-Code M11 symbols vs idiomatic TypeScript (SEPARATE baseline)

This is a **new, three-case M11 dataset**, not an alteration of M10, the two older benchmarks, or the canonical 20-task study. All three tasks were executed with equal stdout using the JS reference and TypeScript Node 22 type stripping, not yet Rust's compiler. The H-Code programs are fully developer-authored generic sum/map/filter functions: **no hidden macros**. TypeScript uses its idiomatic array `reduce`, `map` and `filter` methods and is *not* padded with boilerplate.

Current source-size observations (Unicode code points, including whitespace):

| Task | H-Code | TypeScript | H-Code reduction |
|---|---:|---:|---:|
| Sum | 113 | 100 | -13.00% |
| Map | 159 | 130 | -22.31% |
| Filter | 185 | 167 | -10.78% |

These honest losses reveal why H-Code's later **generic sign operations** `∑`, `⇢` and `⌕` are essential. Merely replacing standard textual operations with a few glyphs will not reach the 70% goal. The planned semantics must work for arbitrary typed sequences and user-defined functions, with inspectable implementations and no hidden AI. Do not claim the 70% target has been met.

The exact sources and outputs are kept here. A second commit adds exact Git blob SHA locks, without touching historical benchmarks. UTF-8 bytes, dependency footprint, runtime performance and AI-token use must be measured separately before a final comparison.
