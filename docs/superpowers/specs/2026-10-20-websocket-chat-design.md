# General WebSocket events and Canonical17 chat

Purpose: complete the unchanged task17 acceptance, two isolated clients, room
join, ordered message delivery and disconnect, using real WebSocket sockets.
This serves the fixed twenty-workload70% median goal; it is not the global proof.
The original registry and every earlier frozen source remain byte-identical.

## Design decision

Add the generic typed effect `⇄(handler,initial)` / `websocket_serve`.
A callback `(event:⦃client:String,data:String,kind:String⦄,state:String)` returns
`⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄`. Kinds are open/message/close.
Opaque client IDs belong to the host. The source callback owns routing and all
application state; the host never knows rooms, chat JSON, identity or sequence.
The callback is synchronous and transitively effect-free. The String state is
in-memory, bounded at1MiB. Each invocation resets native instruction fuel.
This architecture composes existing typed records/JSON/sequences and provides a
reusable event reducer, rather than a chat-specific glyph or host policy.

Alternatives: a chat-specific operation would hide authored logic and invalidate
source accounting; a custom RFC6455 implementation adds avoidable protocol risk.
Use maintained `ws`8.22.0 pinned with npm SRI instead. Node22.13+ native clients
provide an independent wire implementation. TS uses ws directly with its own app
logic; the independent language interpreter shares the generic transport host.

Explicit `HCODE_WS_LISTEN=127.0.0.1:<port>` grant is required, including port0.
Runtime limits:64 peers,16,384-byte text frames/messages,64 outbound records per
event,65,536 queued bytes per recipient,128 HTTP header pairs. Disable compression.
ws validates framing/UTF-8 and reassembles fragmentation. Binary input closes1003;
oversized input1009; invalid UTF-81007. Slow peers close1013. Unsupported routes
reject before upgrade. Validate the entire callback output before state commit
or sends. Unknown/disconnected recipient IDs are dropped to tolerate disconnect
races. Send errors isolate peers. Close invokes the reducer exactly once. No
persistence, offline delivery, multi-process rooms, login or production TLS claim.

## Frozen chat protocol

Open emits `{client,kind:"ready"}` only to that client. Exact input JSON has
`{kind:String,value:String}`. Join uses kind join, value a room name of1..32
Unicode scalars; it atomically replaces prior membership, and replies only to
the sender with `{kind:"joined",members:Number,room:String}`. Members counts
currently joined peers in that room, including self. Same-room join is idempotent.
Say uses kind say, value1..1,024 Unicode scalars, requires prior room join and
broadcasts `{kind:"message",room,sender,sequence,text}` to all current members
including the sender. Sequence is process-global, strictly increases only on
accepted say, and is delivered in server event order. Reject integer exhaustion.
Invalid shape/JSON/Unicode/empty or long value returns `{error:"invalid",kind:"error"}`
only to sender; unjoined say returns error not_joined. Errors never mutate state.
Unknown kinds are invalid. Disconnect removes membership. A new connection starts
unjoined with a fresh ID. State resets on server restart; there is no history.

## Evidence and accounting

Freeze deterministic wire traces and this concrete protocol before applications.
Test compiler type/arity/purity and independently interpreted callback execution.
Run real native/reference/TS servers against two independent Node WebSocket
clients (and extra peers for room isolation), with actual ready/join barriers.
Compare exact complete message lists per client, not sleeps as delivery proof.
For an absence assertion, use a same-connection response barrier then inspect the
entire queued transcript. Invalid frame/size handling is separate transport proof.
Include room switches, interleaved/concurrent sends, Unicode, malformed inputs,
normal/abrupt disconnect, reconnect and more than100 events (fuel reset).
Seed room-leak, sequence and disconnect-cleanup defects and require assertion
failures rather than startup/compile errors. Report source-lock integrity.
Count whole app source, all TS transport/config/input glue, codepoints and bytes.
Report shared fixtures, package/lock metadata, maintained dependency and emitted
runtime separately. No zero-dependency, performance, universal-network or global
70% claim. Browser aggregate timeouts remain visible and must not be bypassed.
