# JFH-CODE cryptographic signs B1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement generic typed `⌁`, `⊩`, `⊨`, `⚄` in both frontends without a session macro.
**Architecture:** Native cryptographic AST operations lower to Node crypto only when required. The independent reference evaluates the same semantics with an explicitly injected host, and journals entropy across async replay.
**Tech Stack:** Existing Rust compiler, dependency-free Node ESM and node:crypto.
**Spec:** `docs/superpowers/specs/2026-10-19-hcode-m19-16-b1-crypto-design.md`.

## Global constraints

- Follow `JFH-CODE-PRINCIPLES.md`; symbol-first authored source, ASCII accessibility only.
- Owner instruction 2026-10-20: TypeScript is the capability reference; implement in JFH-CODE and infer the technical choices independently. Execute inline without another design/plan approval loop.
- Preserve all frozen benchmark source and licensing/name changes on main c103834.
- 65,536-byte messages; 16–64 entropy bytes per call; 64 calls/4,096 total bytes per execution.
- Host-owned 16–128-byte keys, explicit sign/verify rights, no key exposure; no crypto effect in pure packages, CAS reducers or sort keys.
- 15/20 remains the coverage; B1 does not implement the complete session workload.

## Review focus

- Canonical base64url padding bits and constant-size MAC comparison.
- Indirect effectful calls inside sorted keys and replayable reducers.
- Nested crypto arguments retain JSON/HTTP/filesystem runtime linkage.
- Randomness is journaled across multiple suspensions without resetting budgets.
- Missing/prototype grants and error strings never expose key/message/ID data.

### Task 1: Independent signs and crypto host

**Files:** `prototype/src/hcode.mjs`, new `prototype/src/crypto-reference.mjs`, `prototype/test/m19-crypto.test.mjs`.
**Interfaces:** `createCryptoReferenceHost(grants)` returns frozen `{sign,verify,random}`; evaluate accepts `cryptoHost`; pure `sha256Text(text)` uses no key grant.
- [ ] Write tests for known SHA/HMAC answers, malformed MACs, permissions, bounds, aliases and purity; run to observe missing behavior.
- [ ] Implement parser/linker/evaluator nodes and independent crypto host; include runtime host-result validation and sanitized errors.
- [ ] Run dedicated tests and `npm test`; commit only after green.

### Task 2: Replay-safe entropy

**Files:** `prototype/src/hcode.mjs`, `prototype/test/m19-crypto.test.mjs`.
**Interfaces:** per-executeAsync entropy journal stores `{bytes,value}` indexed by source evaluation order, shared across replays but not executions; sync evaluate uses a fresh budget.
- [ ] Add failing tests with two random calls separated by HTTP/sleep suspension and 65-call budget exhaustion.
- [ ] Journal results and validate replay shape; reject invalid host values and perform budget/type checks before calling host.
- [ ] Run dedicated tests and `npm test`; commit.

### Task 3: Rust compiler and generated runtime

**Files:** lexer, AST, parser, checker, codegen under `compiler/src/`; new `compiler/src/crypto_prelude.js`; new `compiler/tests/m19_crypto.rs`; new `scripts/m19-crypto-compiler.test.mjs`.
**Interfaces:** `CryptoOp::{Hash,Sign,Verify,Random}` with typed argument vectors; codegen emits distinct operations and conditionally embeds the prelude, including pure package hash usage.
- [ ] Write Rust positive/negative/alias/effect tests and compiler→Node/reference tests before implementation.
- [ ] Add native tokens/AST/checker, transitive and dynamic effect denial, exhaustive nested traversal and conditional runtime linkage.
- [ ] Generate an independent Node runtime for hash/sign/verify/entropy, explicit grant snapshots and budgets; no application rules.
- [ ] Run local prelude/reference checks, full Node/Studio and available Rust checks. If Rust is absent locally, require focused Windows/Ubuntu CI rather than asserting compilation.

### Task 4: Symbol-first example, evidence and review

**Files:** new `examples/m19_crypto_signs.hc`, symbol docs, focused CI, implementation evidence doc.
- [ ] Add a real sign-first example with no exposed token/key logging; validate its source policy.
- [ ] Record exact tests and remaining B2 session/HTTP/cookie constraints; do not alter frozen registry/baselines.
- [ ] Review complete diff and test suite, then prepare draft PR. No merge/release is authorized by this plan.
