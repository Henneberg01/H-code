# JFH-CODE M19.16 B1 — native cryptographic signs

**Candidate implementation: Linux Rust/compiler verification passed; Windows and hosted CI remain pending. Not merged or released.**

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

Local environment: Node v24.19.0, Ubuntu 24.04 x86_64, Rust/Cargo 1.91.1.
Reproducible evidence: `docs/evidence/m19-16-b1-linux.json`; compiler dependencies
are pinned in `compiler/Cargo.lock`.

| Check | Observed result |
|---|---|
| `npm test` | 181/181 passed, including 13 crypto/reference tests |
| `npm run studio:test` | 16/16 passed |
| `node --test scripts/m19-crypto-runtime.test.mjs` | 4/4 generated-prelude tests passed |
| `node --test scripts/canonical20-auth-contract.test.mjs` | 10/10 passed |
| `node --test scripts/hcode-symbol-first-audit.test.mjs` | 4/4 passed |
| `node --test scripts/test/release-policy.test.mjs` | 6/6 passed |
| `cargo test --locked --manifest-path compiler/Cargo.toml` | 201/201 passed across 47 test targets, no ignored tests |
| `cargo test --manifest-path compiler/Cargo.toml --test m19_crypto` | 4/4 passed (included in the full 201) |
| `cargo build --manifest-path compiler/Cargo.toml` | passed |
| `node --test scripts/m19-crypto-compiler.test.mjs` | 5/5 actual Rust-generated ESM/reference parity tests passed |
| `git diff --check` | passed |

The reference and source-policy tests were observed failing before their
fixes, then passing. Once the local Rust toolchain became available, the
new Rust tests also failed as expected (0 passed, 4 failed) against the original pre-feature
`c103834` compiler, then passed 4/4 against the implementation. The
actual Rust compiler tests, complete Rust suite, CLI build and generated
ESM/reference tests all passed. The two previously pending Important review
fixes are now covered by actual compiler execution, including cryptography
and nested JSON appearing only in a while condition.

Hosted CI remains blocked before execution. The public job page for
[run 39312786506](https://github.com/Henneberg01/H-code/actions/runs/39312786506)
reports: **“The job was not started because your account is locked due to a
billing issue.”** No payment, account-setting change or workflow rerun was
performed. The previous lack of logs is explained by zero started job steps.

Windows execution, hosted Ubuntu CI and required repository security scans
remain pending. Local Linux success does not substitute for those platform
checks. The focused workflow uses `--locked` for reproducibility.

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
and real compiler-execution regressions supplied. These Rust tests now pass
on local Linux, including both previously identified compiler regressions. The reviewer independently
confirmed the entropy budget survives 64 asynchronous replay suspensions.
The historical design now identifies the current implementation status and
JFH-CODE normative principles.
