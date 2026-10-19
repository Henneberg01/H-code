# JFH-CODE — current release policy

The current development revision uses the JFH-CODE name and requires a separate paid commercial agreement. No free use license is granted. See LICENSE, LICENSING.md and COMMERCIAL.md. Local edits do not publish a release or rename the hosted repository.

The M9 notes below are historical and describe a previous revision.

---

# H-Code beta release candidate — M9

**Status:** Private review candidate; **not an officially published version or tag**.

This candidate consolidates the independent H-Code programming language: M1 JavaScript reference interpreter, M2 Rust frontend/typechecker, M3 JavaScript compiler, M4 local .hc modules, M5 calculation demos, M6 local Studio editor, M7 optional separately billed AI-assisted edit proposals and M8 basic execution bounds.

## Significant limitations

- No secure execution sandbox; generated JS inherits Node.js privileges.
- No production-grade package manager or general IO/security capability model.
- No formal source-level compatibility guarantee or independent penetration test.
- The optional real AI API integration and responsive browser UI require separate manual QA.
- This preview is not a public announcement, merged change or released binary.

See README.md, docs/M9_STATUS.md, SECURITY.md and TRADEMARKS.md before distribution.
