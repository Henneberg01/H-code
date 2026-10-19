# JFH-CODE B2a session logic implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. The owner has already authorized independent technical decisions and implementation.

**Goal:** Real sign-first issue/rotate/revoke/expiry backed by generic atomic state.
**Architecture:** A native synchronous ⥁ operation calls a caller-written transition once under SQLite isolation; the whole session policy remains `.hc`. Rust and JS reference independently evaluate the same source; B0 remains the independent correctness oracle.
**Tech Stack:** Existing Rust/Node, built-in node:sqlite and the verified B1 crypto signs.
**Spec:** `docs/superpowers/specs/2026-10-20-jfh-session-logic.md`.

## Global constraints

- JFH-CODE signs are primary; no compiler-owned login/session operations.
- Existing B0 fixtures, oracle and benchmark registration remain immutable.
- B2a has no public HTTP endpoint: trusted identity/time inputs only; B2b remains required.
- ⥁ state <=1 MiB, value <=64 KiB, exactly-once callback, no async replay or nested transaction.
- Session IDs use ⚄18; signing keys stay host-owned; only hashed IDs persist.
- Full project coverage remains 15/20; hosted CI/Windows gates are blocked by the account billing lock.

## Review focus

- Two processes rotating the same token must not both succeed.
- Callback failure, duplicate IDs and malformed results must leave state unchanged.
- No bearer token, raw ID, response receipt or key may enter SQLite or stderr.
- Dynamic pure callbacks and mixed async effects must not invoke state I/O.
- Frozen B0 source, generic transaction semantics and real compiler evidence must remain distinct.

### Task 1: Generic native transaction

**Files:** new `runtime/string-transaction.mjs`, Rust lexer/AST/parser/checker/codegen/packages, reference interpreter and tests.
**Interface:** `createStringTransactionStore({root})` returns `{transact(handler,initial),close()}`; H-Code ⥁ returns String from a typed state/value record.
- [x] Write failing generic-host and sign/parser tests; observe failures.
- [x] Implement permissioned disk-backed state, atomic commit/rollback, bounds and cleanup.
- [x] Implement both frontends, typed callback arity, purity/async guards and conditional linkage.
- [x] Run generic transaction tests, Rust compiler tests and Node suite.

### Task 2: Auth policy in actual JFH-CODE

**Files:** new `compact/canonical20/candidates/16-session-engine-b2a.hc`, new three-engine tests and test-only deterministic entropy preloader.
**Interface:** typed stdin command → JSON result, with durable state maintained only via ⥁.
- [x] Add tests for B0 issue/inspect/rotate/revoke/expiry/reopen and malformed/duplicate/racing operations; observe missing program behavior.
- [x] Author all token/identity/expiry/cookie/state-transition rules in signs.
- [x] Run Rust-generated output and independent reference against the unchanged B0 oracle; test two-process rotation and secret-free DB bytes.

### Task 3: Verify and publish candidate

- [x] Run full Node/Rust/Studio and relevant source-lock/policy checks.
- [x] Perform independent whole-branch review, fix Important findings and run regressions.
- [x] Add focused CI and exact evidence, then create a draft stacked on #74 with remaining B2b/B3 gates explicit. No merge/release.

## Execution record

Native/runtime tests observed RED before implementation; session tests observed the missing source and then five failing compiler cases before GREEN. Permission-root, symbol-audit and direct checker regressions also observed RED before fixes. Independent final review found no Critical/Important issues; its Minor check/build mismatch was fixed and re-reviewed. Linux verification is recorded in the evidence file. Hosted CI/Windows remain pending because of the previously observed GitHub billing lock.
