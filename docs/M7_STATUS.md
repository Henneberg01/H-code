# H-Code M7 — Structured AI edits, local Studio

## Delivered, 2026-10-17
- Model-neutral `hcode.edits.v1` JSON proposal protocol: summary, files, SHA-256 source revisions, exact oldText/newText replacements.
- Studio AI Edit panel: copy source context, paste proposed JSON, preview precise per-file change, approve/apply deliberately.
- No arbitrary eval or fuzzy matching; ambiguous, missing, duplicate, stale, oversized and traversing changes rejected.
- Server holds an opaque approval ID; approval cannot submit a new arbitrary payload.
- Existing file allowlist and authenticated loopback-only local API apply.
- Before applying, checks every original revision; after writing, calls the Rust H-Code static checker. Failed compilation triggers rollback to original content.
- Preview never writes files and does not execute proposed source.

## Example proposal
```json
{"format":"hcode.edits.v1","summary":"Rename invoice title","files":[{"path":"m5/invoice/main.hc","revision":"<sha256 from Studio context>","edits":[{"oldText":"print(\"INVOICE\");","newText":"print(\"INVOICE SUMMARY\");"}]}]}
```

## Important AI limitation
**M7 does not include a connected generative AI model.** Users currently send the copied context to the assistant of their choice and paste the JSON response back. This is AI-ready structured editing, not autonomous AI editing or ChatGPT web integration. No OpenAI API keys or charges introduced.

## Verification
- Studio Node/API tests: 10/10 pass, including read-only preview and unauthorized request rejection.
- M1 Node: 39/39 pass.
- Rust frontend/compiler/M4/M5: 31/31 pass.
- Combined: 80/80 automated tests.
- Studio server restarted on 127.0.0.1:4317.
- Visual browser QA unavailable: Henneberg Browser extension disconnected. No desktop/mobile screenshots were taken.

## Known risks / follow-up
- Local-only tool intended for trusted users on the same machine; not a sandbox for malicious H-Code.
- Best-effort multi-file rollback is not power-failure atomicity; filesystem writes are not transactional.
- Rollback does not undo out-of-band concurrent filesystem changes. Full per-file locking and durable recovery remain for M8.
- A compiler static check cannot prove runtime safety.
- No AI-provider connection or automatic code planning/agent loop.
- GitHub not synchronized.

## Start
From C:\fastsell-local-mcp-portable\projects\H-Code: npm run studio
Open http://127.0.0.1:4317/ in Chrome on the host machine.
