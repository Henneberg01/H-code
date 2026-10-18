# M19 — full independent proof of canonical workload 05

**Branch-only staged draft.** The preregistered workload registry (Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`) remains untouched. The public acceptance is exactly: **deserialize structured input, transform nested typed fields, serialize valid JSON**. The external proof derives status from executable evidence, not by relabelling the immutable JSON registry.

## Implemented user program

```hcode
ƒ transform(raw:String)→String {
  ≔d←⤓⦃user:⦃name:String,score:Number,active:Bool⦄,events:⟦⦃id:String,value:Number⦄⟧⦄raw;
  ≔u←d·user;
  ≔v←u⊞score:u·score+3;
  ≔w←v⊞active:¬u·active;
  ≔r←d⊞user:w;
  ↩ ⤒r;
}
```

`⤓` validates the complete JSON value against actual H-Code structural types. `⊞` performs immutable, typed updates on nested user data. `⤒` serializes a correctly typed nested record and event sequence to valid deterministic JSON. The `.hc` workload also contains real executable calls covering all three fixed positive input variations; those calls **are included** in the codepoint/byte count.

## Evidence and failure gates

- One approved workload, identified by original ID **05** (none renumbered or replaced). `compact/canonical20/cases/05-json-transformation.json` pins **3 positive cases** (multiple list entries, reordered Unicode-containing input, empty nested sequence) and **11 negative cases** (invalid JSON, missing/extra root fields, wrong nested numeric type, missing flag, bad event ID, extra event field, wrong sequence shape, null record/root and nonfinite number).
- An additional **12 reproducible generated positive variations** exercise previously unlisted names, scores, booleans and event-list lengths to check generality. These are runtime tests, not omitted developer code, and they never replace the fixed fixtures.
- Each positive case must produce the same fixed stdout in **three independent paths**: 1) real Rust H-Code parser/typechecker/emitter→Node ESM, 2) JS H-Code reference interpreter, and 3) Node 22 TypeScript with explicit deep runtime-shape validation (no external Zod/import). Each negative case must fail in all three; the Rust compiler itself must successfully compile the negative test, so the failure is from the malformed *runtime data*, not a broken syntax.
- The harness checks the **Git blob SHA of the original 20-workload registry and of the HC, TS and JSON fixture sources**, counts full developer-authored source (function, schema, fixed calls), and records generated JS size and SHA-256 separately. Any mismatch, TS/H-Code output divergence, non-failing malformed input or inability to run Cargo makes CI red.
- `npm run benchmark20:verify05` is the full evidence gate. `npm run benchmark20:status` counts this task as fully verified *only if that gate passes*. `npm run benchmark20:strict` still intentionally fails until all 20 are proven.

## Verified source-size measurements for one full task

| Metric | H-Code | TypeScript | Change |
|---|---:|---:|---:|
| Developer-authored Unicode codepoints | 594 | 2,005 | **70.37% fewer** |
| Developer-authored UTF-8 bytes | 651 | 2,007 | **67.56% fewer** |
| Actual compiler-generated Node ESM | **6,560 bytes** | Not measured equivalently | Counted separately |

The H-Code output artifact is verified by SHA-256. The source pair uses an idiomatic TypeScript baseline with a real handwritten recursive runtime guard and canonicalized JSON event serialization. **An unchecked TS cast is not equivalent**, and dependency byte counts, compile-time, runtime timing and generic TS compiler typecheck have not yet been benchmarked.

**No global 70% conclusion:** only **1 of the original 20** is fully verified on this stacked branch, with 2 partial and 17 unsupported. The original M14 median **68.46%** is an independent historical three-case result and remains unchanged. The target of ≥70% median across all 20 remains open.

## Integration status

Draft PR #25 layers on JSON PR #24, record PR #23, M19 registry PR #22 and M16.3 PR #21. No commit from this stacked chain was merged directly into `main`. All layers require review and coherent order of integration. Evidence from Linux and Windows CI must refer to the **exact final head commit**.

Source hashes:
- Registry: `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`
- Positive/negative fixture: `6e151dd70cbb16b160349688be8f86aad06c54ee`
- H-Code authored source: `9e98f97129e6c40c41ba4635f63fe9af26275f19`
- TypeScript authored source: `f01524c5559aa4606348ef166a4ff7ad5b5ed46b`
