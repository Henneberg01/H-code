# JFH-CODE release checklist

1. Keep repository visibility unchanged unless the owner explicitly authorizes a visibility change. Source access does not itself grant use rights.
2. Verify the rights holder's details, ownership of project code and explicit commercial sublicensing rights for accepted contributions. Git authorship alone is insufficient.
3. Check LICENSE, LICENSING.md, COMMERCIAL.md, NOTICE, TRADEMARKS.md and CONTRIBUTING.md together. The current policy requires a paid commercial agreement and offers no free use license. Preserve third-party notices and existing legal permissions.
4. Check that npm packages declare `UNLICENSED`, the compiler points to the commercial LICENSE, and README/Studio use **JFH-CODE**. Compatibility identifiers and frozen historical sources may retain earlier technical names.
5. Exclude credentials, .env files, generated binaries and compiler/target from source releases. Include third-party license notices with any binary distribution and agree embedded-runtime distribution rights explicitly.
6. Run `npm test`, `npm run studio:test`, `cargo test --manifest-path compiler/Cargo.toml`, `npm run release:check` and representative CLI/Studio smoke checks.
7. Review the complete diff. Preserve all twenty benchmark registrations and their source hashes. A licensing or branding change does not establish the 70% source-reduction target.
8. Apply the reviewed change to the actual GitHub default branch and verify its LICENSE and README. Rename the hosted repository to **JFH-CODE** using authorized GitHub administration access, then update remote links and managed-environment metadata to the confirmed identity. Local edits alone do not rename the hosted repository.
9. Agree customer permissions and prices in writing before granting a license. Do not invent a signed agreement, purchase flow, release tag or publication result.
