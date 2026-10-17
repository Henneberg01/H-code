# H-Code decisions and unresolved questions

## Accepted for the M1 reference prototype

- General-purpose symbolic language independent of FastSell.
- Glyphs are human-friendly syntax for precise operations, not secret encodings or stored hidden code.
- ASCII aliases and fully qualified function names remain supported for accessibility and tooling.
- M1 reference lexer/interpreter/locked-library linker is written in JavaScript for speed of experimentation.
- Initial production compiler frontend is provisionally Rust; JavaScript the first code-generation target.
- Explicit braces/semicolons simplify deterministic parsing in M1.
- Initial numeric implementation uses JS Number; long-term numeric semantics are undecided.
- User-defined operation packages use exact `name@MAJOR.MINOR.PATCH` import syntax.
- Initial offline library manifest (`format: 1`) and lockfile (`lockVersion: 1`) require explicit source and manifest SHA-256 hashes.
- Initial user-defined symbols require one Unicode category-S codepoint, NFC/NFKC stable, cannot override core glyphs.
- M1 library operation contracts use `Number`, `String`, `Bool`, `Unit` and `effects: []` only.
- Packages are executable pure H-Code source, NOT arbitrary JS plugins. Full security capabilities are postponed.
- H-Code Studio starts through existing editor infrastructure rather than recreating a whole IDE.
- No claims of performance benefits without external validation.
- Apache-2.0 source license included; commercial AI/hosting services may be offered separately.

## Open decisions before stable compiler / public release

1. Final product name and trademark review.
2. Fully statically enforced type system, numeric semantics, records, collections and generics.
3. Declaration immutability, ownership, resource lifetimes and memory model.
4. Error/result types, effect system and asynchronous programming.
5. Formal semantics for user-defined syntax macros, hygiene, recursive imports and exports.
6. Full module/manifest format, package manager, transitive dependencies and publishing; the M1 offline format is provisional.
7. Stable package ABI, operation signature migrations, reproducibility and source maps.
8. Strong sandboxing, signed releases, package provenance, OS capabilities and supply-chain policy.
9. WebAssembly/native targets, runtime integration and portable platform APIs.
10. Commercial plans, AI billing limits, cloud spend controls and validated pricing.
