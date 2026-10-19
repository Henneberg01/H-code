> Historical record: the licensing and branding assumptions in this document are superseded by the owner-directed JFH-CODE paid-use policy of 2026-10-19. See [current licensing](../LICENSING.md), [commercial terms](../COMMERCIAL.md) and [project principles](../JFH-CODE-PRINCIPLES.md). This document grants no current use permission.

# H-Code M1 progress report — 2026-10-17

## Newly implemented: offline user-defined symbol packages

- Parser supports `use "name@1.0.0" as alias;`, `alias::operation`, `alias∷glyph` and standalone imported glyph calls.
- User-defined operations have real `.hc` source implementations and typed manifest definitions.
- Linker resolves glyph and ASCII calls to the same fully version-qualified `OperationRef` AST node.
- Offline SHA-256 lockfile pins both library source and manifest, rejecting silent changes.
- Module-scope isolated execution, effect-free (`effects: []`) library contracts and runtime argument/result checking.
- Deterministic rejection of duplicate aliases, ambiguous glyphs, reserved-symbol collisions and unknown imports.
- Added reusable `demo.math` package, an example program and a complete authoring guide.
- **39/39 Node.js tests passing** after this change; original 17 baseline tests remain passing.

## Already present before this change

- Base language grammar with 14 core glyphs, variables, function calls, lexical scopes, conditionals and loops.
- CLI runner and minimal AST output.
- 10 original executable sample programs.
- Apache-2.0 source license, CI definition, milestones and architecture documentation.

## Current milestones

- **M0**: locally functional Git repository and CI files; **GitHub remote still not created** (connector lacks repository-creation action and Henneberg Browser bridge unavailable).
- **M1**: user-defined symbol registration/reference linking and offline version locking implemented. Full language-design questions and broader benchmarks remain open.
- **M2–M3**: not started (no Rust compiler frontend or JavaScript backend yet).
- **M4**: first offline package-linking *prototype* exists, but no complete module/package manager or remote registry.

## Honest limitations

The executable engine is a JavaScript reference **interpreter**. Only directly obvious argument types are checked at link time; arbitrary programs are not statically checked. Hash checks are not digital signatures or a security sandbox. There are no verified development-time, AI-token or runtime performance gains yet.
