# Canonical17: room chat over real WebSocket connections

Concrete fixture established on 2026-10-20 for the unchanged acceptance:
`two isolated clients, room join, ordered message delivery and disconnect`.
The original twenty-task registry retains Git blob
`46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`. No task or denominator is removed.

## Provenance and generic capability

Commit `6489e6d8a9b9997a71da7af29d6ba063858d664e` freezes the concrete protocol
and four wire traces before either chat application is implemented. The contract
manifest has Git blob `d6fd2be3672e671db7d7974529eb730985d7151f`. This dated
fixture expands the original brief; no earlier concrete task17 app is claimed.
A second manifest locks every whole-app source file, the maintained dependency
lock and retained upstream notice. The verifier rejects altered contract/data,
source, manifests, extra hidden application files and symlinked implementations.

`⇄(handler,initial)` / `websocket_serve` is a general typed event effect.
The synchronous callback accepts event `⦃client:String,data:String,kind:String⦄`
and String state; it returns `⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄`.
Kinds are open/message/close and IDs are opaque connection identifiers. The host
owns only transport, limits and ordered callbacks. The source program owns room
membership, input validation, message construction and sequence advancement.
There is no chat-specific compiler expansion or routing policy in the host.

The native Rust compiler and independent language evaluator implement the same
operation. Callback checks follow named functions, lambdas, map/filter and
composition helpers and registration inside nested expressions/branches. I/O,
printing and capture mutation are rejected. Native and reference execution budgets
reset per event. The reference now preserves typed empty JSON sequence constraints
through record updates and provides contextual empty-sequence types for ordinary
functions. Wrong element types still fail.

Transport uses maintained `ws` 8.22.0 with its exact npm SRI lock and MIT notice.
`npm ci --ignore-scripts --no-audit --no-fund` installs it. Generated native ESM
resolves that dependency from the compiler checkout's package root; deployment
must retain that installation. An explicit `HCODE_WS_LISTEN=127.0.0.1:<port>`
grant is required. Limits are 64 peers, 16,384 incoming/outgoing text bytes per
message, 64 outgoing records per event, 65,536 queued outgoing bytes per recipient,
1MiB state and 128 HTTP header pairs. Compression is disabled. Binary closes 1003,
invalid UTF-8 closes 1007, oversized messages close 1009; slow-recipient queues close 1013.
Complete output validation precedes state commit or any outgoing send, including
sparse-array rejection. Closed/unknown recipients are dropped for disconnect races.

## Chat behavior

Opening a connection returns a private ready message. Exact JSON `{kind,value}`
commands join a Unicode room of 1..32 scalars or send text of 1..1,024 scalars.
Joining replaces prior membership and replies with the current room member count;
same-room rejoin is idempotent. Say requires a prior join and broadcasts to that
room including the sender. A process-global sequence advances only for accepted
say commands. Invalid/extra/wrong-type fields, malformed JSON/Unicode, unknown
commands and size errors return a private error without changing state. Closing
removes membership; a reconnect has a fresh ID and starts unjoined. Sequence
exhaustion rejects further messages without wrapping or changing membership.

This fixture has no authentication, TLS, history, persistence, offline delivery
or distributed-room claim. A server restart starts a new in-memory session.

## Executable evidence

`npm run benchmark20:test17` starts actual native, reference and TypeScript
servers. Primary clients use Node's independent standard WebSocket implementation.
The abrupt-disconnect case runs a standard client in its own process, then kills
that process to produce a genuine unclean connection loss. The JS language
reference shares the generic transport with native. TypeScript owns independent
application state and routing but uses the same maintained ws protocol library;
this is not three independent wire implementations.

| Evidence | Verified |
|---|---:|
| Fixed / generated / abrupt-disconnect / counter-boundary runs | 12 / 24 / 3 / 3 |
| Accepted chat messages across those runs | 2,526 |
| Messages sent concurrently in ordered bursts | 2,388 |
| Normal and abrupt disconnects combined | 30 |
| Forced isolated-client process kills | 3 |
| Deliberate room/sequence/disconnect faults rejected | 9 |

The run performs over 950 complete-transcript assertions and sends over 3,000
client commands. Counts can increase with bounded close-processing barriers.
A 600-message burst checks that the callback budget is per event. Exact entire
per-client wire transcripts include private errors/joins and all broadcasts.
Per-connection response barriers establish absence of messages from other rooms;
fixed sleeps are not delivery evidence. Concurrent sends permit either legitimate
server arrival order, then independently check the input permutation, expected
sender/room/counter fields and identical delivery order on both recipients.

A close acknowledgement can precede the server's close callback. The proof uses
up to 100 same-connection join-response barriers to observe correct member removal;
it never assumes client closure means server cleanup has already finished.
Counter-boundary runs use temporary app initialization variants at the maximum
safe integer. They are distinguished from executions of the delivered app bytes.
Each fault changes one application expression: room isolation, increment or close
cleanup. Compile/launch errors are not accepted as fault rejection. Assertions
must detect an actual wrong message, transcript or bounded membership result.

Transport tests additionally use real fragmented messages, exact UTF-8 byte limits,
binary/malformed frames, 64-peer capacity, upgrade-header budgets and atomic
output validation. Review regressions reproduced impure named map/filter helpers
and a sparse-array partial send/state commit, then passed after fixes. Reference
regressions reproduced typed-empty sequence and function-context differences.
The full Rust suite passes 233 tests, the JS reference 185 and Studio 17. Targeted
chat/transport/integrity tests pass 11 named tests; 54 selected prior HTTP/CAS,
session, refactor, bug-repair and incremental-feature tests also pass.

## Whole-source measurement

| Delivered source | Unicode codepoints | UTF-8 bytes |
|---|---:|---:|
| Whole JFH-CODE app | 1,689 | 2,065 |
| Whole independent TypeScript app | 3,968 | 3,968 |
| Reduction for this workload | 57.43% | 47.96% |
| Common frozen JSON fixture | 1,257 | 1,272 |
| JFH-CODE including common fixture | 2,946 | 3,337 |
| TypeScript including common fixture | 5,225 | 5,240 |
| Reduction including fixture | 43.62% | 36.32% |

All authored input/protocol/routing/configuration/transport glue is included.
Neutral proof drivers, isolated clients and reference hosting are test
infrastructure, without hidden application policy. The maintained transport is
one external npm dependency; its installed 19-file inventory totals 151,410 bytes,
with hashes measured by the verifier. The dependency lock and notice add 2,113
shared metadata bytes. These are separate from application source and common JSON.
Native generated ESM is 18,408 bytes, SHA-256
`a23549128b694025adec44c2a447cd8da62e6db125d8f886e9290b0a03521108`;
it is measured anew, separately from handwritten source. Node/Rust/toolchain
size, runtime performance and AI-token use are not measured here.

This task's source reduction is below 70%. Conditional language acceptance
coverage becomes 20/20 only if every actual proof passes, including Chromium.
`acceptanceComplete` describes that coverage; `complete`, global medians and
`objectiveAchieved` remain false/null pending the full benchmark and fair-baseline
assessment. `--require-complete` is the all 20 acceptance gate, not a 70% certificate.
The known actual-browser timeout prevents a successful aggregate readiness
report; no browser checks may be skipped to claim completion. The final aggregate
rerun with explicit `/usr/bin/chromium` has 4 passes and 2 failures: task13 times
out in the actual-browser comparator, and the all 20 gate returns exit 1 for that
execution failure rather than a successful acceptance report. Root npm installation
is now included before full Rust CI, and task17 has an explicit CI proof step.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run benchmark20:verify17
npm run benchmark20:test17
HCODE_CHROME=/usr/bin/chromium npm run benchmark20:test
```
