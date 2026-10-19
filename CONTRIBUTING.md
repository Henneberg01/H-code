# Contributing to JFH-CODE

JFH-CODE is proprietary software requiring a paid commercial license. Discuss proposed contributions with the rights holder before submitting code. Read [LICENSING.md](LICENSING.md) and [COMMERCIAL.md](COMMERCIAL.md).

## Rights required before acceptance

Do not accept a contribution until its author provides an explicit written agreement granting Jonas Fogh Henneberg, operating as Fastsell.net, the necessary copyright and applicable patent permissions to use, modify, distribute and sublicense it under proprietary commercial terms.

A pull request, Git author name or developer sign-off is not, by itself, that agreement. Contributors may retain ownership, but the grant must cover commercial sublicensing. Employer-owned, jointly owned and third-party code needs permission from the relevant rights holders. Do not submit secrets, proprietary code belonging to others or material you cannot license. Record permission before merging a contribution.

Previously and lawfully granted permissions and third-party licenses remain effective. This policy does not retroactively create ownership or commercial sublicensing rights over earlier contributions.

## Development checks

For the rights holder and developers authorized by a commercial agreement:

```sh
npm test
npm run studio:test
cargo test --manifest-path compiler/Cargo.toml
npm run release:check
```

Include tests for behavior changes and preserve historical SHA-locked benchmarks. Follow CODE_OF_CONDUCT.md. Paid CI runs, publication and releases require the appropriate authorization.
