# Twenty-task acceptance evidence, 2026-10-20

All **20/20 original workloads** passed the complete acceptance gate in this
cloud. Zero tasks were omitted, unsupported or left as partial evidence.
The original registry remains Git blob
`46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.
This is development-branch evidence; these stacked changes are not merged into
`main` and do not establish a released compiler or the global 70% objective.

The actual output is [the saved acceptance run](../results/canonical20-acceptance-2026-10-20.json).
It reports `acceptanceComplete: true`, while `complete`, `objectiveAchieved`
and `compilerProvenanceValidated` remain false and certified global medians
remain null. The gate runs the existing Rust compiler proofs, independent
references and task-specific comparisons. A complete competitive-baseline and
compiler-provenance audit is still required before benchmark certification.

Final validation also passed all six aggregate regression tests (including a
fresh, separate twenty-proof process), all four real Chromium driver tests,
all 185 reference-interpreter tests, release checks and `git diff --check`.
The source recount matched its saved inventory exactly and rejected omitted
tasks, altered counts and altered source hashes. The reusable install script
was executed successfully with locked npm installation, Rust build and all
four browser tests. CI wiring was added; remote CI results are not claimed here.

## Browser blocker and correction

System Chromium 154.0.8037.57 actually loaded and executed the local pages,
but its `--dump-dom` command did not return. D-Bus availability did not fix it.
The new [CDP launcher](../../scripts/chromium-cdp.mjs) captures DOM from that
same real Chromium through its debugging protocol. No browser policies,
network permissions, frozen apps, fixtures, probes or acceptance assertions
were changed. This is an opt-in launcher; the stock browser path remains usable.

The driver starts virtual time after the actual page load. Starting it before
navigation exhausted the budget on `about:blank` and prevented navigation.
It captures the resulting DOM, retires its test tab, and closes the browser
cleanly. Retiring the tab prevents the managed restore-on-startup policy from
executing the previous app twice. localStorage persists across launches.

Four real-browser tests cover module/event/timer execution, storage across
independent launches, missing executables/unfinished loads, and a deliberately
stopped browser. The timeout regression failed before the fix (8.87 seconds
with a 3.5-second deadline) and passed after it (about 4.06 seconds including
process cleanup). Abort rejects pending CDP work immediately; owned browser
processes are terminated even when they cannot complete a WebSocket handshake.
Independent review reproduced the corrected stopped-browser test.

Task13 passed all nine HTML5 form scenarios; task14 passed its fifteen-stage
trace with actual browser restarts and persistent state; task15 passed the
unchanged SQLite/dashboard and real-browser proof. Tasks16–20 also passed the
complete gate. No existing browser harness SHA lock was rewritten.

## Source size diagnostic

[The source inventory](../results/canonical20-source-inventory-2026-10-20.json)
contains actual paths, Git blob hashes, Unicode code points and UTF-8 bytes for
every counted file. Its generator checks those files against the saved run.
It **recounts saved evidence**, rather than rerunning acceptance tests.

| Task | JFH-CODE code points | TS code points | Raw reduction | Comparator status |
| --- | ---: | ---: | ---: | --- |
| 01 Calculator CLI | 11 | 2365 | 99.53% | Correctness oracle |
| 02 Fibonacci | 96 | 94 | -2.13% | Source pair to audit |
| 03 Unicode frequencies | 437 | 1541 | 71.64% | Source pair to audit |
| 04 CSV validation | 258 | 3936 | 93.45% | Correctness oracle |
| 05 JSON transformation | 594 | 2005 | 70.37% | Source pair to audit |
| 06 HTTP retries | 776 | 3112 | 75.06% | Correctness oracle |
| 07 File conversion | 173 | 3135 | 94.48% | Correctness oracle |
| 08 Concurrent requests | 123 | 1549 | 92.06% | Correctness oracle |
| 09 Expiring cache | 460 | 2180 | 78.90% | Correctness oracle |
| 10 Collection transforms | 505 | 836 | 39.59% | Source pair to audit |
| 11 Markdown | 19 | 4103 | 99.54% | Correctness oracle |
| 12 CRUD API | 3098 | 8772 | 64.68% | Correctness oracle |
| 13 Form UI | 418 | 705 | 40.71% | Source pair to audit |
| 14 Todo app | 1456 | 1999 | 27.16% | Source pair to audit |
| 15 Database dashboard | 1266 | 5488 | 76.93% | Source pair to audit |
| 16 Signed sessions | 2403 | 7762 | 69.04% | Source pair to audit |
| 17 WebSocket chat | 1689 | 3968 | 57.43% | Source pair to audit |
| 18 Refactored project | 1313 | 2068 | 36.51% | Source pair to audit |
| 19 Repaired project | 1728 | 2874 | 39.87% | Source pair to audit |
| 20 Extended project | 2169 | 4380 | 50.48% | Source pair to audit |

The median of these **mixed comparisons** is **69.71% fewer Unicode code
points** and **65.85% fewer UTF-8 bytes**, using unrounded individual ratios.
Eight TS comparators are correctness oracles, so these numbers cannot certify
the objective. The other twelve pairs also require a competitiveness review;
their label is not a claim that review is complete. A ratio against a long
standalone parser is not automatically a fair comparison with maintained TS
libraries. No development-time, runtime-speed or AI-token saving was measured.

Counts include entire source files, comments and whitespace. Task02 retains
the original recursion rather than substituting its shorter glyph candidate.
Task15 counts the already-proven B4 backend plus browser source. Tasks18–20
count the entire corresponding final projects, including authored tests.
Shared HTML/JSON, generated JavaScript, libraries and host runtime are excluded
from this **source-only** diagnostic. Consult individual proofs for those costs;
this table is not a deployment-size comparison.

## Reproduce and continue

Basic reference use needs Node20; complete acceptance needs Node22.13+, Rust,
root `npm ci`, a real Chromium and loopback access. In this cloud:

```sh
cd /workspace/H-code
. /workspace/.hcode-environment/activate.sh
npm run browser:driver:test
npm run benchmark20:strict
npm run benchmark20:test
node scripts/canonical20-source-inventory.mjs
```

Outside this cloud on Linux, set `HCODE_CHROME` to the absolute executable path
of `scripts/chromium-cdp.mjs` and `HCODE_CHROME_BINARY` to the actual Chromium
binary to opt in. The launcher uses Node's WebSocket implementation and local
HTTP fixtures. CI continues to exercise its ordinary Chrome acceptance path
and additionally runs the Linux driver tests.

For a fresh JSON acceptance report, run
`node scripts/canonical20-coverage.mjs --require-complete > /tmp/canonical20.json`,
then `node scripts/canonical20-source-inventory.mjs /tmp/canonical20.json`.
A saved JSON report is historical evidence; it never proves a fresh test pass.

The next benchmark task is the competitive TS baseline audit, beginning with
the eight oracle comparisons (01, 04, 06, 07, 08, 09, 11, 12). Existing maintained
library comparators for 01 and 04 can be assessed without replacing the frozen
correctness oracles. New comparator versions must preserve the original
acceptance, use SHA-locked sources and dependencies, pass the same cases, and
report their package/host costs separately. Then measure all twenty together
and improve general typed signs for the weakest workloads. Keep negative
results, all twenty tasks and the original 70% target.
