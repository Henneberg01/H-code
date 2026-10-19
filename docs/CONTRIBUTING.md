# Contributing to JFH-CODE

Current licensing and contribution-rights requirements are defined by [CONTRIBUTING.md](../CONTRIBUTING.md) and [LICENSING.md](../LICENSING.md). A separate paid commercial agreement is required for use. This technical guide grants no permission.

M1 is experimental. Keep proposal/design changes and runtime changes separate. Every semantic change must update `docs/LANGUAGE_SPEC.md`, `grammar/hcode-m1.ebnf`, relevant examples and `prototype/test/hcode.test.mjs`.

Run `npm test` before opening a pull request. No new dependency should be introduced to the reference interpreter without a written rationale. Do not claim a compiler feature exists if it is only a design sketch. For security issues, avoid posting exploit details in a public issue before the project publishes a security disclosure process.
