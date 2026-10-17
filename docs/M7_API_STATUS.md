# H-Code M7 API integration — local completion note

Implemented in H-Code Studio on 2026-10-17:
- API key entry shown at Studio startup, with model selection and Test and connect.
- Server-side OpenAI model check and AI change requests, default gpt-5-mini; optional gpt-4.1-mini.
- Secret stays in Node process memory, not saved to file or browser storage; disconnect button.
- AI proposes a hcode.edits.v1 JSON change; existing revision-checked preview, manual approval, typecheck and rollback remain mandatory.
- Copy-context and manual JSON proposal flow retained as fallback.
- Node Studio automated tests passed 12/12, including mock provider test and browser-script parse.
- Live provider verification has NOT been performed because no user API key was provided.
- The Henneberg Browser extension was not available for screenshot visual QA, so responsive UI remains unverified.
- Uses OpenAI's API billing, separately from ChatGPT subscription.
- Local-only and not a sandbox; do not expose port 4317 to the internet.
- GitHub was not updated in this task.

To run: npm run studio from C:\fastsell-local-mcp-portable\projects\H-Code; open http://127.0.0.1:4317/ in Chrome.
