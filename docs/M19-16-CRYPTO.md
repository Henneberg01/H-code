# JFH-CODE M19.16 B1 — native cryptographic signs

**Candidate implementation; not merged, released or Rust/compiler-verified.**

The owner's direction is capability breadth comparable to TypeScript,
expressed as JFH-CODE signs carrying general-purpose typed semantics.
This change implements cryptographic language primitives required before
the session algorithm can be authored in JFH-CODE.

```hcode
≔ id←⚄24
≔ message←"jfh-example/v1/"+id
≔ mac←⊩("example",message)
⎙(⊨("example",message,mac))
≔ digest←⌁id
```

Actual executable source: `examples/capabilities/crypto-signs.hc`.
It requires a host-granted key alias `example` with sign/verify rights and
an explicit entropy grant. The reference test injects its own public
test-only key. The program outputs only the verification result.

## What is implemented

- Native Rust lexer/parser/AST/typechecker/emitter operations for `⌁ ⊩ ⊨ ⚄`,
  with equivalent secondary ASCII aliases.
- Independent reference parsing/evaluation and Node crypto adapter.
- Independently implemented generated ESM cryptography using Node's native
  SHA-256, HMAC-SHA256, timing-safe comparison and OS CSPRNG.
- Exact canonical base64url checks, bounded well-formed UTF-8 messages,
  explicit per-key sign/verify permissions and no key-returning operation.
- Pure hash allowed; key and entropy effects forbidden in pure packages,
  sorted keys and replayable CAS reducers, including runtime indirect calls.
- Per-execution entropy journal across async replay, 64 calls/4,096 bytes,
  16–64 bytes per call, with no hidden entropy fallback.
- Conditional runtime linkage: pure hashing has no key-grant or entropy
  runtime, and existing programs without crypto do not link crypto.
- Source audit rejects the four ASCII crypto aliases in new/changed primary
  `.hc` programs, while immutable accessibility/benchmark fixtures remain.

The compiled Node runtime reads an explicit version-1
`HCODE_CRYPTO_GRANTS` JSON grant at startup. Key definitions contain a
host-supplied hex value and Boolean `sign`/`verify` rights; `random:true`
grants entropy. There is no default key. Never put production secrets in
JFH-CODE source, generated code or benchmark fixtures.

The reference interpreter has no ambient environment grant: a trusted host
constructs `createCryptoReferenceHost(grants)` and passes it as `cryptoHost`
to `execute` or `executeAsync`. Its key snapshot remains private to the host.

## Verification actually performed

Local environment: Node v24.19.0, Linux.

| Check | Observed result |
|---|---|
| `npm test` | 181/181 passed, including 13 crypto/reference tests |
| `npm run studio:test` | 16/16 passed |
| `node --test scripts/m19-crypto-runtime.test.mjs` | 4/4 generated-prelude tests passed |
| `node --test scripts/canonical20-auth-contract.test.mjs` | 10/10 passed |
| `node --test scripts/hcode-symbol-first-audit.test.mjs` | 4/4 passed |
| `node --test scripts/test/release-policy.test.mjs` | 6/6 passed |
| `git diff --check` | passed |

The newly added tests were observed failing before reference implementation
and before extending the source-policy gate, then passing. The first Rust
conformance tests were committed before the Rust production changes, but
could not execute: this workspace has no Rust toolchain. Initial GitHub
Actions jobs on `8ac1d319f91f05bf354b802567f906cda830c3c1` ended in failure
with **zero started steps** and unavailable job logs. The cause is not
established. This is not evidence of a Rust code-test failure or pass.

Required pending checks are the actual Rust test suite/build, real compiled
ESM ↔ reference execution (`scripts/m19-crypto-compiler.test.mjs`), Windows
and Ubuntu CI, and any required repository security scans. A focused
cross-platform workflow is supplied in `.github/workflows/m19-crypto.yml`.
Standalone Node prelude tests do not substitute for compiling the emitter.

## Remaining session work and measurement

Canonical16 is still unverified. B2 must express issue/rotate/revoke in
JFH-CODE, add appropriate HTTP cookie boundaries, trusted time and a
replay-safe key/entropy context, and prove durable atomic state changes.
B3 must freeze a fair independent TypeScript comparator and execute the
same contract through actual Rust, reference, HTTP and persistence paths.

Coverage remains **15/20**; the immutable original registry and all prior
benchmark source remain unchanged. No new TypeScript size comparison,
overall 70% achievement, performance or production-readiness claim is made.

## Independent review

A separate read-only reviewer found two Important issues: missing runtime
linkage for while-condition operands, and custom-host acceptance of
noncanonical MAC input. The interpreter boundary regression was observed
failing, then passing after canonical validation was added. Every conditional
runtime detector now visits while conditions, with new Rust compile/output
and real compiler-execution regressions supplied; those Rust tests remain
unexecuted for the environment reasons above. The reviewer independently
confirmed the entropy budget survives 64 asynchronous replay suspensions.
The historical design now identifies the current implementation status and
JFH-CODE normative principles.
