# H-Code M1: create and import your own symbol library

> Status: **Implemented in the M1 JavaScript reference interpreter**, offline only. This is a deterministic symbol linker with runtime type contracts, not the M2 static type system or the planned package registry.

The symbol belongs to a **versioned package**, not to the global language. Unicode glyphs and readable names compile/link to the same `OperationRef` node.

## Runnable example

```hcode
use "demo.math@1.0.0" as math;
print(⊕(20, 22));       // 42
print(math::add(20, 22)); // 42
print(math∷⊕(20, 22));   // 42
print(⊗(5));             // 120 (recursion in the library)
```

From project root:

```bash
npm test
node prototype/bin/hcode.mjs check examples/user_symbols.hc --lock hcode.lock.json
node prototype/bin/hcode.mjs run examples/user_symbols.hc --lock hcode.lock.json
node prototype/bin/hcode.mjs ast examples/user_symbols.hc --lock hcode.lock.json
```

### Build a symbol library

1. Create a project-local package folder, e.g. `packages/my.math/`.
2. Write **pure H-Code functions** in `lib.hc` with explicit types:

```hcode
fn add(a: Number, b: Number) -> Number {
  return a + b;
}
```

3. Add `manifest.json` (complete runnable example: `packages/demo.math/manifest.json`):

```json
{
  "format": 1,
  "name": "my.math",
  "version": "1.0.0",
  "source": "lib.hc",
  "operations": [{
    "name": "add",
    "glyph": "⊕",
    "parameters": [
      {"name": "a", "type": "Number"},
      {"name": "b", "type": "Number"}
    ],
    "returns": "Number",
    "effects": [],
    "implementation": "add"
  }]
}
```

4. Lock the **exact package version and file contents** in the project's `hcode.lock.json`:

```json
{
  "lockVersion": 1,
  "packages": [{
    "name": "my.math",
    "version": "1.0.0",
    "manifest": "packages/my.math/manifest.json",
    "manifestSha256": "<64 hex digits of the manifest file bytes>",
    "sourceSha256": "<64 hex digits of the lib.hc file bytes>"
  }]
}
```

Calculate hashes with `sha256sum` (or PowerShell `Get-FileHash -Algorithm SHA256`). This is an experimental offline format; a lockfile generator and package publishing workflow are scheduled for a later milestone. A developer changing a package must intentionally update the pinned hashes.

5. Import the exact version:

```hcode
use "my.math@1.0.0" as math;
print(math::add(2, 3));
print(⊕(2, 3));
```

Packages are only loaded from explicit `--lock` input. There is **no download**, dynamic JavaScript loading, global auto-import or call to an AI model at runtime.

## Resolution and name collision rules

- Every `use` must be top-level, specify `name@MAJOR.MINOR.PATCH`, and define a unique ASCII alias.
- `math::add` and `math∷⊕` always select an operation from the `math` package.
- A bare glyph `⊕` works only if it belongs to **exactly one** explicitly imported operation. If two imported packages declare it, linking fails with an ambiguity error; qualify it.
- Packages cannot replace core syntax (`ƒ`, `←`, `∷`, etc.), nor the reserved future glyphs (`∅`, `∀`, `∈`). A package's user glyph must be a single Unicode symbol stable under NFC and NFKC.
- Canonical linked ID: `my.math@1.0.0::add`; text and glyph calls yield identical linked ASTs.
- A library can export as many operations as needed, and can include additional non-exported H-Code helper functions.

## Contracts and effects

- Current supported argument and return types: `Number`, `String`, `Bool`, `Unit`.
- Loading validates that each exported H-Code function's parameter and return annotations match its manifest signature exactly.
- Linking validates arity and types **when arguments are statically obvious literals**; runtime validates all exported operation calls, including indirect first-class calls through variables.
- Runtime also verifies the returned value matches `returns`. This is **not yet full static checking** of arbitrary H-Code programs.
- M1 accepts only `effects: []`. Library source runs in an isolated interpreter scope with **no builtin `print`, file, network, environment or host JavaScript bindings**. Effects/capabilities require explicit future design and authorization.
- An interpreter step limit applies across both app and library functions. It limits interpreter work but is **not an isolation/security boundary** for hostile code; native JS recursion, CPU exhaustion, memory and other host concerns still need rigorous sandbox design.

## Reproducibility and trust

`manifestSha256` and `sourceSha256` are **integrity checks only**, not proof of who published the library or that it is safe. Anyone controlling the lockfile can update its hashes. Full package signing, dependency graphs, offline vendoring, vulnerability checks, capability enforcement and robust static contracts remain future milestones.

Lockfile paths must be local relative paths and cannot escape the project using `..` or symlinks. Project assets are constrained to 1 MiB per lockfile, manifest or source file in this early reference implementation.

## Important current limitations

- No generic types or `List<T>`/`Map<K,V>` yet.
- Only pure functions as top-level library declarations; no imports within libraries, native FFI, JS callbacks or distributed package registry.
- No automatic source maps or stable binary format.
- H-Code Studio and production compiler are **not yet built**.
- `check` links package names and verifies direct obvious-argument contracts, but it is not full-program static typechecking.
