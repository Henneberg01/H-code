# Contributing to H-Code

H-Code is an experimental symbolic programming language. Discuss substantial feature changes in an issue before sending a focused pull request. Include behavior-oriented tests and update documentation when behavior changes.

## Local checks

```sh
npm test
npm run studio:test
cargo test --manifest-path compiler/Cargo.toml
npm run release:check
```

Do not include secrets, copied proprietary software, vendor artifacts, generated binaries or code you are not legally allowed to contribute. By intentionally submitting a pull request, you confirm you have the authority to grant the project the right to distribute your contribution under Apache License 2.0. There is currently no separate CLA; third-party code and additional rights should be cleared before inclusion.

Follow CODE_OF_CONDUCT.md and keep GitHub Actions usage controlled; the CI workflow is manually triggered to avoid unplanned compute charges.
