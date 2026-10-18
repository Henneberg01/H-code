# M15 frozen eight-task parity benchmark

This is the **same eight M10 program tasks**, not the three convenient M14 collection samples and not the final twenty-task study.

- Original TypeScript: `compact/benchmarks/paired/*.ts` — **unchanged**, exact Git blob SHA in `manifest.json`
- Historical M10 H-Code: `compact/benchmarks/paired/*.hc` — **unchanged**, separately SHA-locked
- Current M15 H-Code: `compact/benchmarks/m15/*.hc` — handwritten symbol-first equivalents, no artificial sample replacement

Tasks: typed function, function composition/chaining, Fibonacci, counter loop, greeting, boolean guard, factorial, conditional branch. All eight must compile to matching stdout in the real Rust compiler, and the eight original idiomatic TypeScript baselines execute in Node22+.

`npm run m15:measure` computes median reductions on the full eight, counts real Unicode code points and UTF-8 bytes independently. Full program dependency size, AI tokens and runtime performance are **not measured**; the final canonical 20 workloads remain incomplete.

**Frozen-data policy:** Never alter any of the 24 compared sources in place. New iterations need a new manifest version. Include regressions.
