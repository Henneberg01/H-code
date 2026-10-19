# M19.16 B0 — independent signed-session correctness contract

**STATUS: B0 CONTRACT ONLY. Canonical16 is NOT verified. No H-Code crypto/session compiler feature is claimed, and global coverage remains 15/20 only after #71 is independently green and merged.**

## Original preregistration, unchanged

- Original registry: `compact/canonical20/workloads.json` blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.
- Original workload ID: `16-auth-sessions` (16/20).
- Original acceptance: `issue/rotate/revoke a signed session using deterministic fixture identity`.
- Capabilities: `cryptography`, `http-server`, `persistent-session`.
- The existing registry remains **unsupported**, with no evidence. Never change the original 20-task denominator to inflate compression metrics.

## Frozen test-only baseline

- Fixture `compact/canonical20/cases/16-auth-sessions.json` Git blob `1861703aed80bcf4c324ad6519d8810a12bde765`.
- Independent reference `compact/canonical20/idiomatic/16-auth-session-oracle.ts` Git blob `02dc03af5ea422afd5adc970f18d07f3411da142`.
- Contract tests `scripts/canonical20-auth-contract.test.mjs`, run in Node 22 with the built-in disk-backed SQLite driver.
- All signing keys, identities and IDs are **public deterministic test fixtures**. They MUST NOT be reused in production, and must not be treated as production entropy or secrets. Real IDs require host-granted CSPRNG, and real signing keys require host-managed secret access.

The independent baseline uses HMAC-SHA256 domain separation over a versioned session identifier, exact canonical base64url parsing (including mandatory literal `.` token separators), and constant-time signature comparison. It stores only a SHA256 digest of the session identifier in a real persistent SQLite database; signing keys and raw bearer tokens are not stored there. Rotation revokes the old identifier atomically, preserves the original expiry, and is single-use across independent database connections. Explicit revocation is idempotent. Expiry is exclusive. Tokens have strict length and alphabet limits.

## Required B0 checks

1. RFC 4231 known-answer HMAC test independent of the session oracle.
2. Issue then verify the deterministic identity and expiry; signed cookie must use `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` and no Domain.
3. Rotation invalidates prior token and does not extend its lifetime; concurrent/repeated rotate of one token cannot both succeed.
4. Revocation survives an independent SQLite reopen and never resurrects an old/rotated token.
5. Wrong secret, malformed/modified token, duplicate session ID, invalid identity, injected markup, invalid TTL and expiry-boundary inputs fail closed.
6. Test fixtures and TypeScript reference have exact Git-blob SHA1 locks; original 20-workload registration is unchanged.

## Next language work (B1–B3; not implemented)

- **B1** Introduce general *symbol-first typed* cryptographic primitives for HMAC and constant-time verification with explicit host-owned key capabilities, alongside a permission-gated random identifier source. No `issueLogin()` domain macro, no hardcoded user or cookie names, and no TypeScript-style source syntax masquerading as H-Code.
- **B2** Express session issue/rotate/revoke and durable state/HTTP behavior **in developer-written H-Code** using those general primitives. Signed tokens must never leak via logs. Test restart and two-process race isolation. The Rust compiler and independent H-Code JS interpreter must agree on the exact B0 contract.
- **B3** Freeze independent idiomatic TypeScript comparator, run the same fixture/adversarial cases, then measure Unicode codepoints, UTF-8 bytes, generated ESM, runtime and dependency footprints **separately**. Add original task16 to coverage *only* once exact-head Windows, Ubuntu, browser/API, security and CodeQL gates are green.

**A reference implementation by itself is not H-Code progress toward 70% fewer authored source characters.** The sign-first design, compiler-backed H-Code session application and fair independent comparator must be completed before counting Canonical16.
