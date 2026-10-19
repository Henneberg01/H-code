# Canonical12 — source-authored H-Code CRUD API, derived proof

## Contract and original files (never edit)

The canonical workload registry, original six CRUD HTTP fixtures, and the standalone TypeScript correctness oracle remain unchanged from the preregistered task:
- Registry `compact/canonical20/workloads.json`: Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.
- Original fixtures `compact/canonical20/cases/12-crud-api.json`: Git blob `0383e7ed4c342cc39756822a2a6581d833c53a76`.
- Original TypeScript correctness oracle `compact/canonical20/programs/12-crud-api.ts`: Git blob `6ac016aaf88620578cfc36a82b6f4a94b3b72c9e`.
- Complete user-authored H-Code program `compact/canonical20/programs/12-crud-api.hc`: Git blob `b3ba6542ef27474390a7354c8c01a22464156179`.

The original task requires **create, read, update, delete, strict validation and deterministic persistence**. It is not enough to prove one endpoint or a prewritten JavaScript CRUD package. The H-Code program itself declares the typed request/response contract, routing, typed JSON validation, ID/name/version validation, record updates, and persisted state transformations.

## Native language, runtime and fairness

The symbols `⤊` (typed HTTP state server), `⤔` (typed recoverable JSON validity), `⤓` (strict typed JSON read), `⤒` (typed JSON serialization), `⌕` (generic filtering), and `⇢` (generic mapping) are **general-purpose language operations** in the Rust compiler and independent JavaScript reference interpreter. They are not CRUD/task12-specific macros.

The native Rust compiler generates Node ESM with a shared bounded transactional CAS state runtime. Its immutable revision files deliberately differ from the TypeScript reference's `items-state.json`. Correctness requires the **same logical persisted records after every operation and after restart**; comparing on-disk storage formats would incorrectly conflate implementation details with behavior. CAS supplies durable request-ID receipts, crash recovery and multi-process conflict resolution subject to the documented 256-revision/128-receipt limits.

Run:

```sh
npm run benchmark20:verify12-hcode
npm run benchmark20:verify12-js
npm run benchmark20:verify12-three
npm run benchmark20:measure12
npm run benchmark20:status
```

`scripts/canonical20-verify-12.mjs` is the derived evidence gate invoked by `readiness()`. It rechecks **Git blob SHA locks**, immutable acceptance criteria and required capabilities, then actually runs the separate Node test process for `scripts/canonical20-verify-12-three-engines.test.mjs`. That test compiles the H-Code source with the real Rust compiler and executes:

1. The **six unchanged original CRUD scenarios**, including actual sockets, persisted state and restarts, in Rust-generated H-Code ESM, independent H-Code JavaScript interpreter, and real TypeScript server. Exact HTTP status, JSON response bytes, MIME headers and logical persisted records must agree with the original fixture after every step.
2. A multi-record CRUD route scenario verifying generic handling.
3. Four independently generated multi-entity Unicode scenarios validating create/read/update/delete, stale versions, duplicates, restart and state consistency.

The test emits `CANONICAL12_GENERATED_JS_BYTES` and `CANONICAL12_GENERATED_JS_SHA256` computed from the real emitted file. The proof gate **rejects** missing metrics, skipped tests, a nonzero subprocess exit, any unexpected source hash or changed acceptance contract. The preregistration JSON keeps its original `unsupported` label on purpose: coverage is now derived exclusively from the compiler's actual proof.

Additional CI suites exercise malformed JSON, invalid Unicode, response header injection, simulated concurrent PUT requests, durable ID replay across server restarts and CAS revision corruption. Those are supplemental security coverage rather than substitutes for the immutable six-case tests.

## Exact source metrics versus the correctness oracle

| Measurement | User-authored H-Code | Independent TypeScript correctness oracle |
|---|---:|---:|
| Unicode code points | 3,098 | 8,772 |
| UTF-8 source bytes | 3,721 | 8,772 |

This corresponds to a **provisional 64.68% source codepoint reduction and 57.58% UTF-8 byte reduction against the correctness oracle only**, including the present H-Code file's comments. It is **not** a fair, proven idiomatic/maintained-library TypeScript benchmark. Compiler-generated JavaScript bytes/SHA-256, the H-Code compiler/runtime, TypeScript dependencies, runtime behavior and execution performance must be reported separately. Until a competitive TypeScript comparison exists, never use these numbers to claim the 70% target.

**Status:** task12 becomes compiler-verified in a branch only when its strict source-locked derived proof and exact-head Windows/Ubuntu CI gates succeed. Do **not** promote the canonical 20 workload count on `main` or merge this PR on incomplete CI. The final global 20-task median remains unavailable until all 20 workloads have equivalent proofs.
