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
- [ ] Add failing Rust/JS conformance tests for published vector, aliases, types,
  tampering, malformed/oversize input, pure-package reservations and nested effects.
- [ ] Run them RED, implement AST and recursive visitors plus opt-in runtime, run GREEN.
- [ ] Run existing compiler/reference tests and commit the standalone capability.

## Task 2: Generic HTTP header envelope

Files: HTTP request checker, codegen, HTTP state/server preludes, focused tests.
Interface: optional `headers:⟦⦃name:String,value:String⦄⟧` in expanded request.
- [ ] Add failing tests for five-field request type, duplicate mixed-case headers,
  real HTTP delivery, and unchanged old three/four-field handlers.
- [ ] Implement raw header metadata and typed records without collapsing duplicates.
- [ ] Verify CAS/read-only behavior and old HTTP tests; commit.

## Task 3: Canonical16 application and proof

Files: new task16 contract/fixtures, native and TS apps, JS reference HTTP host,
proof verifier/tests and measurement docs; derived coverage integration.
- [ ] Commit fixture identity, protocol and acceptance before app implementation.
- [ ] Write HTTP acceptance tests and observe missing-capability/feature failure.
- [ ] Implement the spec's routes and durable generation/revocation in both apps.
- [ ] Run native/reference/TS flows, duplicate headers, tampering, invalid input,
  concurrent rotation, graceful/forced restarts, and extra generated keys/traces.
- [ ] Reject deliberately broken MAC checks, revocation or rotation implementations.
- [ ] Freeze/count full source and report generated/runtime/common data separately.
- [ ] Run relevant regressions, independent review, and document actual blockers.
- [ ] Commit and push development branch, confirming remote commit identity.
