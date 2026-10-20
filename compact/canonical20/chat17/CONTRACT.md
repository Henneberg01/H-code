# Canonical17 concrete room-chat contract — 2026-10-20

Original acceptance: `two isolated clients, room join, ordered message delivery and disconnect`.
This dated fixture expands that brief without replacing the original twenty IDs.

Separate real WebSocket clients receive private `{client,kind:"ready"}` on open.
IDs are opaque, fresh for every connection, and never trusted from input.
Input JSON has exactly two well-formed String fields: `{kind,value}`.
`join` accepts a1..32-Unicode-scalar room name and replaces prior membership;
reply only to sender: `{kind:"joined",members,room}`, counting joined live peers
including self. Same-room rejoin is idempotent. `say` requires prior join and
1..1,024 Unicode scalars; broadcast including self:
`{kind:"message",room,sender,sequence,text}`. Process-global sequence starts0,
increments only for accepted say, and uses server event order. Safe-integer
exhaustion is rejected with error exhausted without mutation. Each recipient
observes increasing sequence, with possible gaps for messages in other rooms.

Unknown kind, wrong/extra fields, malformed JSON, invalid Unicode, empty/oversized
value => private `{error:"invalid",kind:"error"}` without mutation. Unjoined say
=> private `{error:"not_joined",kind:"error"}`. Disconnect removes membership.
Reconnect is fresh/unjoined. No chat history or state survives server restart.

The maintained WebSocket transport enforces explicit loopback grant,64peers,
16,384-byte message and65,536-byte outgoing queue bounds,128header pairs,
no compression. Binary closes1003; invalid UTF-81007; oversized message1009.
Callbacks are generic pure event reducers; no room/routing policy belongs to host.
This is fixture chat, with no authentication, TLS or production account claim.
