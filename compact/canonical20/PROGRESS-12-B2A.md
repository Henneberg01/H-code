# M19.12 B2a — generic durable HTTP handler state (draft)

**Not complete B2 and not original CRUD task12. Canonical20 remains 11/20.**

## True H-Code expression

\`⤊(handler,"0")\` or ASCII \`http_serve(handler,"0")\` is a stateful overload of the same symbol introduced in B1, not a CRUD-specific builtin.

- Stateless B1 \`⤊handler\` remains unchanged, including its typed \`Request -> Response\` handler and permission requirements.
- Stateful B2a signature:
  \`(Request,String state) -> {body:String,state:String,status:Number}\` where
  \`Request={body:String,method:String,path:String}\`.
- All route dispatch, business rules, state transitions and data shapes are authored in **H-Code**.
- Rust's **real lexer/parser/AST/typechecker/emitter** typechecks the signature and effect context. JS reference interpreter parses the same glyph/alias and requires injected \`httpServeState\` host. No hidden CRUD transformation or invocation.
- Generated ESM activates a separately measured, bounded persistent state capability only when the two-argument overload is present.

## Runtime capability and durability

The two **explicit** host grants are:
\`HCODE_HTTP_LISTEN=127.0.0.1:0\`, and
\`HCODE_HTTP_STATE_ROOT=ABSOLUTE_CANONICAL_EXISTING_DIRECTORY\`.

Storage is an **application-neutral String reducer state**. It loads \`hcode-http-state.json\` (version, sequence, state), validates its schema and fatal UTF-8, then commits state updates using an exclusively created temporary file, fsync, atomic same-directory rename, and directory fsync on POSIX. State string is capped at 1 MiB; HTTP B1 body/response bounds continue to apply. A verified root path cannot be a symlink. Overwriting a symlinked state target is denied. Invalid handler output must not commit. No lockfile-, compiler- or handler-level hardcoded item/CRUD schema.

The host uses a single-process exclusive lock \`.hcode-http-state.lock\`. Since request handlers remain synchronous, every reducer invocation and commit completes before the next reducer executes on the Node event loop; this prevents lost updates between concurrent requests **within that process**. Starting a second writer process to the same root fails closed instead of silently forking state.

**Explicit B2a limitations:** A crash/SIGKILL leaves the lockfile as a conservative block on automatic restart. Recovery requires a trusted host to verify no writer is alive and remove the stale lock. This B2a version does **not** provide automated crash lock recovery, cross-process distributed transactions, async request effects or general persistence for other data types. On Windows, directory fsync is not attempted. No claim of power-loss-proof durability, isolation across untrusted tenants, or fully verified canonical12 yet.

## Tests and required next work

\`npm run benchmark20:state12b2a\` builds the genuine H-Code stateful HTTP example with Rust→Node ESM, starts a real localhost server, sends requests, restarts the process gracefully, checks stored sequence and state, compares independent JS interpreter outputs for both \`⤊\` and \`http_serve\`, concurrently issues twelve increment requests and checks no lost updates, and verifies security/type failure cases. Run on both Ubuntu and Windows, plus existing B1/CSE/Canonical20 regression suites and CodeQL before merge.

**B2 remaining:** crash-safe lock recovery or durable transaction manager, request-scoped idempotence/replay mechanism, stronger fault injection around fsync/rename/commit, transaction and state schema flexibility. **B3/B4 remaining:** real user-authored CRUD service satisfying all original six frozen fixtures and additional generated tests; exact Rust/JS/TS parity; only then 12/20 readiness. 70% total reduction remains unproven.
