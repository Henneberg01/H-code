# Numeric module and native tests

From the repository root:

```sh
npm run language:test
npm run test:example
```

`number.test.hc` imports the pure `number.hc` module and executes four Boolean
assertions. The independent TypeScript files implement and check the same four
conditions using Node's built-in test and assertion modules. The comparison
requires Node 22+ and an available Cargo toolchain.

Measured on 2026-10-19, including both module and test files, all imports and
whitespace:

| Metric | JFH-CODE | TypeScript | Reduction |
|---|---:|---:|---:|
| Handwritten Unicode codepoints | 194 | 435 | 55.40% |
| Handwritten UTF-8 bytes | 240 | 435 | 44.83% |

The compiled test contains 5527 bytes of generated JavaScript, reported
separately. The measuring script rebuilds the current compiler, executes both
implementations, and reports each source file's SHA-256 so results can be tied
to the measured contents. Generated size can change with the compiler.

This is one small demonstration, outside the unchanged Canonical-20 workloads.
It does not establish the global 70% target or measure runtime speed, AI tokens
or dependency size. Native tests are groundwork for workloads 18–20, which
still need their own acceptance proofs.
