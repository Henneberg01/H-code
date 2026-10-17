# H-Code M6 — local Studio editor

## Delivered 2026-10-17
- Standalone local web IDE bound to http://127.0.0.1:4317/ via dependency-free Node server at studio/server.mjs.
- Responsive interface: project explorer, H-Code source editor, glyph insertion palette, Save, Check, Build, Run, compiler/runtime output.
- Shortcuts: Ctrl/Cmd+S saves; Ctrl/Cmd+Enter runs; Tab inserts two spaces.
- Reads editable H-Code files from examples/, m4/, m5/; no project migration or FastSell app changes.
- Change detection via SHA-256 revision tokens; unsafe paths / symlink escape rejected; 128 KiB file limit; API session token.
- Uses Rust hcodec.exe, compiled by cargo, and Node.js for generated JS; subprocess output bounded and 7-second kill timer.

## Start
Open a terminal in C:\fastsell-local-mcp-portable\projects\H-Code.
1. cargo build --manifest-path compiler/Cargo.toml
2. npm run studio
3. Open http://127.0.0.1:4317/ on the same PC.

## Tests
- studio:test: 4/4 tests pass (HTTP API, auth, file listing, path restrictions).
- M1 Node: 39/39.
- M2-M5 Rust: 31/31.
- Total: 74/74.

## Limitations
- Browser screenshot QA could not be completed because Henneberg Browser extension was not connected. Tests do not prove visual rendering or responsive behavior.
- The compiler's generated JS still lacks a sandbox and robust instruction budget: only run trusted .hc programs.
- Basic textarea editor without LSP/autocomplete/debugger, project creation, Git interface, file rename/delete, or syntax highlighting.
- Local server is not designed for network exposure. Do not proxy it publicly.
- Saved output is studio/output.mjs, overwritten by successive Build operations. Build is intended for temporary previews.
- Work exists on Windows MCP H-Code project only, not yet pushed to GitHub.
