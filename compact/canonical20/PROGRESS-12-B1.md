# M19.12 B1 — typed inbound HTTP server foundation

**Not canonical12 CRUD acceptance. Status remains 11/20.** This is the first real generic H-Code inbound server capability, layered after the independently tested B0 TypeScript CRUD oracle.

## New source operation

- Glyph **⤊** = ASCII alias **http_serve**.
- Signature: \`(⦃body:String,method:String,path:String⦄ → ⦃body:String,status:Number⦄) → Unit\`.
- The handler is a **user-defined typed H-Code function**. The compiler never inserts a CRUD handler, route table, storage, validation schema or product-specific logic.
- **Rust lexer/parser/AST/typechecker/emitter** enforce the handler signature and top-level-only effect; no outgoing-HTTP permissions are implied.
- **JS independent H-Code reference** parses both forms and requires the host to inject an \`httpServe\` capability (no ambient binding).
- **Compiled Node ESM runtime** embeds a generic loopback HTTP listener only if the sign is used. Explicit host grant \`HCODE_HTTP_LISTEN=127.0.0.1:0\` is required. The readiness line \`HCODE_HTTP_READY=PORT\` is host process metadata, not the H-Code handler's response.

B1 request object fields are \`method\`, \`path\` and a bounded 16 KiB UTF-8 \`body\`. The return record has \`status\` (integer 200–599) and \`body\` (well-formed UTF-8 up to 64 KiB). Node rejects malformed UTF-8, excess body, invalid handler output, missing binding grant and more than 32 in-flight requests. Callback execution is synchronous/pure for B1; its shared variables must not be taken as proof of a concurrent transactional data model.

## Proof

\`npm run benchmark20:serve12b1\` builds an original H-Code server source through the actual Rust compiler; starts that compiled server over real loopback HTTP; compares the same user-authored glyph handler and ASCII alias evaluated in the independent JS interpreter; tests three distinct request methods/paths/bodies, denied ambient network permission, type-negative H-Code sources, invalid Unicode and request limits.

This is a *foundation slice*, not complete CRUD. Still required: effectful request-scoped storage, durable serializable transactions across process restarts, actual H-Code CRUD service with schema validation and HTTP routing, all original fixtures against Rust+JS+independent TypeScript, source-locked evidence and fair idiomatic source comparisons.

**No canonical20 status promotion or global ≥70% compression claim.** Not an untrusted-code sandbox.
