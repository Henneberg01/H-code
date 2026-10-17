# H-Code architecture decision record — 2026-10-17

## Separation of concerns

1. **Source frontend:** ASCII/glyph lexer and parser.
2. **M1 linker:** local `use` imports, locked package resolution, symbol/qualified-name normalization to `OperationRef`.
3. **Semantic analysis:** type/effect analysis (partial runtime contracts in M1; full M2+).
4. **H-IR:** target-agnostic typed intermediate representation (M2+).
5. **Backends:** JavaScript compiler first; WebAssembly/native research only after measured demand.
6. **Libraries:** general-purpose typed H-Code operations; platform effects require explicit capabilities later.
7. **Tools:** CLI and language server before H-Code Studio.
8. **AI:** optional development tool, never required at runtime.

## Executable M1 reference architecture

```text
  UTF-8 .hc program              hcode.lock.json
         |                         |
       lexer                SHA-256 locked manifests/sources
         |                         |
       parser               pure .hc library parser
         |                         |
  unlinked AST ----------> explicit symbol linker
                                   |
                          canonical OperationRef AST
                                   |
                             interpreter
                          /               \
                       main scope      isolated package scope
                          |               |
                       print()       pure typed functions
```

`prototype/src/hcode.mjs` is a dependency-free lexer/parser, linker and interpreter; `prototype/src/packages.mjs` verifies offline package lockfiles, types and source. Node.js 20+ executes the reference runtime. These files are **not a production compiler** and are not H-IR.

No downloaded JavaScript is dynamically executed; packages comprise H-Code source functions under the reference evaluator. No ambient library print/file/network/host functions exist. Integrity hashes alone are not publisher authentication, and interpreter step budgets are **not a hostile-code security sandbox**.

## Priorities

- Make observable semantics precise before optimization.
- Preserve canonical linked AST equivalence between glyph and qualified ASCII call spellings.
- Avoid syntax that is hard to type, search, review, copy or read aloud.
- Require explicit package versions, declared effects, locked content and namespace collision checks.
- Benchmark realistically against production languages and existing libraries.
- Keep this project completely separate from FastSell.

## Branch/release strategy

Keep `main` buildable; implement features on branches, verify test gates and submit PRs to the future independent H-Code repository. Until the GitHub remote exists, local Git commits and distributable Git bundles are the source of truth.
