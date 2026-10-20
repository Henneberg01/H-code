# Signed stateful sessions for Canonical16

Goal: implement the unchanged Canonical16 contract, `issue/rotate/revoke a signed
session using deterministic fixture identity`, using general typed language
operations. Preserve JFH-CODE's sign-first syntax and existing programs. Do not
change the original twenty-task registry or claim the global 70% target.

## General language capabilities

- `✍(key, message)` / `hmac_sign(key,message)` returns a lowercase 64-character
  HMAC-SHA-256 hex string. Both arguments are String, interpreted as exact UTF-8.
- `✓(key,message,tag)` / `hmac_verify(key,message,tag)` returns Bool. All arguments
  are String. Only canonical lowercase 64-hex tags can verify. Compare the full
  32-byte expected MAC with Node's `timingSafeEqual`, not language string equality.
- Key/message must be well-formed UTF-16 strings, bounded at 4,096/65,536 UTF-8
  bytes respectively; invalid types/text/lengths throw without echoing input.
  Short keys remain permitted for generic HMAC and published test vectors.
- These deterministic operations are allowed in pure libraries, CAS reducers
  and sorting keys. Their operands still undergo all transitive effect checks.
  Rust and JS reference use separately written adapters around Node crypto.
  No custom hash algorithm, signing secret, session route or identity is built
  into the compiler. Existing output without these operations stays compatible.
- Add an optional five-field stateful HTTP request shape: `body:String`,
  `contentType:String`, `headers:⟦⦃name:String,value:String⦄⟧`, `method:String`,
  `path:String`. Headers preserve raw occurrences, with lowercase names.
  In this new envelope, reject more than128 raw header pairs with431 and disable
  silent header-count truncation before application callbacks. Keep existing three/four-field requests and responses working. This permits
  an application to reject duplicate security headers instead of trusting a
  host's collapsed header map. Header data is transport metadata, not auth logic.

## Application protocol

One fixed fixture identity (`fixture-alice`) and a public test credential are
used solely for reproducible acceptance. This is not a production password
provider, JWT implementation or complete account system. Sessions have explicit
rotation/revocation, not time-based expiry in this contract.

Read the signing key from `data/signing-key.txt` at startup through existing
file-read capability; no built-in/default key. Accept 32..1,024 Unicode scalars
(well-formed UTF-8), allowing at most 4,096 bytes. Tests supply public fixture
keys; real deployments must provide their own high-entropy key. Never log keys.
Persist `{generation:Number,revoked:Bool}`, initially `{generation:0,revoked:true}`.
Generation increases monotonically on issue and rotation; never reuse it on
revoke, restart or reissue. Reject unsafe-integer exhaustion without mutation.

Each issued response exposes `{generation,identity,signature}`. The signature
is HMAC of the exact canonical JSON `{generation,identity}`. It is a symmetric
MAC-authenticated stateful session, not an asymmetric digital signature.
Clients send the 64-hex value in exactly one `x-session-signature` header. The
server authenticates against its current durable generation/identity, not
untrusted client claims. GET verification must always read current state;
mutating-request idempotency receipts must never cache a stale authentication
success. GETs already have no committed receipts in the existing CAS host. The app also
rejects every `x-hcode-request-id` header with400: the generic transport receipt
digest now binds headers for the five-field envelope, but auth routes must
never replay a stale success after the underlying session has changed. Legacy
request envelopes retain their original four-part digest.

- POST `/session`: exact JSON `{identity,credential}`, JSON content type;
  incorrect credentials =>401, malformed/wrong-type/extra fields =>400.
  On success increment generation, clear revocation, return201 with token.
- GET `/session`: empty body and exactly one signature header; return200 with
  current `{generation,identity}` iff not revoked and MAC valid, else401.
- POST `/session/rotate`: empty body, valid current signature; advance generation,
  return200 with new token; previous token immediately fails.
- POST `/session/revoke`: empty body, valid current signature; persist revoked,
  return204; subsequent verification/rotation/revocation with that token fails.
- Wrong method=>405, unknown route=>404, unexpected body=>400, all without state
  changes. Errors use JSON `{error}` with no secrets. Host enforces UTF-8/body
  bounds. All responses retain the existing no-store behavior.

Use existing native CAS persistence. The independent TypeScript HTTP app uses
Node crypto and the maintained SQLite implementation supplied by Node22.13+,
with synchronous transactions and full durability. Both support concurrent requests within a process,
normal restart and forced process restart. Multi-host availability, expiration,
password storage, cookies, CSRF, TLS and power-loss durability are not claims.

## Evidence and measurement

Freeze the concrete fixture contract/identities before implementation; the
original registry had a brief, not a concrete task16 snapshot. Test published
RFC HMAC vectors, tampered/malformed tags, UTF-8 boundaries, alias/type parity,
package glyph reservation, nested effect rejection, and opt-in runtime emission.
Exercise actual native and TypeScript HTTP servers, plus the JS reference with
a trusted HTTP/CAS host. Issue, verify, tamper, rotate, replay old token, revoke,
restart and reissue; race two rotations and require one winner. Reject duplicate
headers, invalid credentials and malformed inputs without changing state. Use
extra generated traces/keys and deliberate faults to avoid fixture-only success.
Count complete delivered application source in codepoints and bytes, including
all input/persistence glue. Report common fixture and generated/runtime bytes
separately. Distinguish compiler/reference conformance from task16 proof. Keep
all previous source locks intact and report the known Chromium aggregate block.
