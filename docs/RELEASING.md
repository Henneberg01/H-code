# H-Code M9 release checklist

1. Keep `Henneberg01/H-code` private until public visibility is separately authorized.
2. Confirm `Jonas Fogh Henneberg / Fastsell.net / CVR 46614887` with authoritative legal/company records and verify ownership of any third-party contributions.
3. Check complete Apache-2.0 LICENSE, copyright/NOTICE, trademark, commercial, security and contributor documents.
4. Verify release candidate contains the complete M1–M8 source without API keys, .env files, credentials, generated binaries or the local `compiler/target` directory.
5. Execute `npm test`, `npm run studio:test`, `cargo test --manifest-path compiler/Cargo.toml`, `npm run release:check` and `npm run demo` locally.
6. Review the complete GitHub branch diff and run manual Windows/browser QA. Do not publish an actual OpenAI API key.
7. Open a **draft pull request** from `feat/m9-beta-release` into `main`, but do not merge automatically. GitHub Actions runs only on `workflow_dispatch` to avoid automatic CI charges.
8. Separately approve **public repository visibility**, licensing and an official beta release/tag only after technical, security and legal review. PR creation is not publication.
