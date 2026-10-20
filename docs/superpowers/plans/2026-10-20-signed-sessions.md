# Signed sessions implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Work proceeds inline with independent final review.

**Goal:** Prove Canonical16 issue/rotate/revoke with authenticated durable state.
**Architecture:** Generic HMAC syntax and optional raw HTTP-header request fields
support user-authored session policy. Native CAS, a trusted JS reference host and
an independent TypeScript server execute the same frozen protocol.
**Tech stack:** Rust frontend, JavaScript ESM/Node22+, Node crypto/http/fs.
**Spec:** `docs/superpowers/specs/2026-10-20-signed-sessions-design.md`.

## Global constraints

- Preserve the original twenty-task registry and all earlier frozen sources.
- UTF-8 key/message bounds are 4,096/65,536 bytes; canonical MAC is 64 lowercase hex.
- Existing HTTP request shapes stay valid; raw lowercase header occurrences survive.
- No built-in session policy, identity or default secret; no global 70% claim.
- Application signing-key length is 32..1,024 Unicode scalars.

## Review focus

- Duplicate or mixed-case security headers must not become one trusted header.
- Revocation and generation must survive forced restart, preventing old-token reuse.
- Pure HMAC must not hide effectful operand expressions from CAS/sort/package checks.
- Invalid input and concurrent rotations must not advance/overwrite session state.
- Native/reference/TS adapters must agree on exact UTF-8 bytes and reject malformed MACs.

## Task 1: Generic HMAC primitives

Files: compiler AST/lexer/parser/checker/codegen/packages; new HMAC runtime prelude;
prototype parser/evaluator and independent crypto adapter; conformance tests; symbol docs.
Interface: `✍(String,String)→String`, `✓(String,String,String)→Bool`, ASCII aliases.
- [x] Add failing Rust/JS conformance tests for published vector, aliases, types,
  tampering, malformed/oversize input, pure-package reservations and nested effects.
- [x] Run them RED, implement AST and recursive visitors plus opt-in runtime, run GREEN.
- [x] Run existing compiler/reference tests and commit the standalone capability.

## Task 2: Generic HTTP header envelope

Files: HTTP request checker, codegen, HTTP state/server preludes, focused tests.
Interface: optional `headers:⟦⦃name:String,value:String⦄⟧` in expanded request.
- [x] Add failing tests for five-field request type, duplicate mixed-case headers,
  real HTTP delivery, and unchanged old three/four-field handlers.
- [x] Implement raw header metadata and typed records without collapsing duplicates.
- [x] Verify CAS/read-only behavior and old HTTP tests; commit.

## Task 3: Canonical16 application and proof

Files: new task16 contract/fixtures, native and TS apps, JS reference HTTP host,
proof verifier/tests and measurement docs; derived coverage integration.
- [x] Commit fixture identity, protocol and acceptance before app implementation.
- [x] Write HTTP acceptance tests and observe missing-capability/feature failure.
- [x] Implement the spec's routes and durable generation/revocation in both apps.
- [x] Run native/reference/TS flows, duplicate headers, tampering, invalid input,
  concurrent rotation, graceful/forced restarts, and extra generated keys/traces.
- [x] Reject deliberately broken MAC checks, revocation or rotation implementations.
- [x] Freeze/count full source and report generated/runtime/common data separately.
- [x] Run relevant regressions, independent review, and document actual blockers.
- [x] Commit and push development branch, confirming remote commit identity.

## Execution record

- Generic HMAC/header capability and pre-application contract: commit01cef3b.
- Actual session policy initially failed because no HTTP reducer existed;
  implemented policy then passed native/reference/TypeScript HTTP acceptance.
- Real file-read plus CAS emission exposed duplicate imports; the emitted-ESM
  syntax regression failed before namespacing and passed after the fix.
- BOM-prefixed key parity and invalid-surrogate credential cases failed before
  fixing the TS/reference decoders and TS input validation, then passed.
- Final task16 suite:5/5; all888 HTTP assertions,45 forced crashes,42 rotation
  races,18 startup negatives and9 application faults verified.
- Full Rust226/226, reference181/181, Studio17/17; previous project/HTTP/CAS
  regression selection49/49. Release and symbol-first checks passed.
- Independent capability/application and accounting/integration reviews found
  no remaining important issues. The evidence document and grammar gap noted
  during concurrent review were corrected.
- The original registry and all earlier frozen workload/application sources
  are byte-unchanged. Aggregate Chromium verification remains a separate gate.
- Aggregate rerun with explicit `/usr/bin/chromium`:4 passed/2 failed.
  Task13 actual browser comparator times out; strict gate exits1 for that
  execution failure rather than2 for incomplete workload support. No browser
  test was skipped or treated as passing.
- Application proof published on `codex/jfh-code-signed-sessions` at878a35c;
  explicit remote fetch confirmed identical local/remote commit identities.
