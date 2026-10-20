# Canonical19: reproduce and repair a seeded traversal bug

The unchanged preregistered task requires: **reproduce seeded failure, fix actual
root cause and verify regression test**. This fixture is established on
2026-10-20 using the source-locked numerical project delivered for task18 in
commit be6badf576cec884d30895b88855a7ba73611b94. The bug is deliberately seeded
for this benchmark; no production-bug discovery or repair-time claim is made.

The seed applies an accidental sixteen-value processing limit in the shared
core loop. All twelve original inputs have at most five values, so the original
tests must still pass. The new regression inputs place unique extrema beyond
the sixteenth value. Both direct statistics and the transitive report module
must inspect every value. The strictly positive summary must apply the same
correct behavior after filtering.

The fixture contains five reproducing inputs and one exactly-sixteen-value
control. Each reproducer must fail by an assertion in the seeded native and
TypeScript projects; the control must pass. A failing compiler, process-launch
error or timeout is not evidence of reproducing the bug.

Freeze the seeded project, new tests, expected data and this contract in a
separate commit before writing the repaired variant. Repair the actual loop
bound without modifying original tests, new regression assertions, public APIs,
or expected data. Repaired application source must match the prior good task18
source exactly. Reintroducing the seeded core into the repaired full project
must reproduce the assertion failures again while the original tests still pass.

The repaired version must pass the original twelve cases, all six new cases,
and thirty-two additional generated boundary inputs. Run the real Rust compiler
and test runner plus independent TypeScript against the same data. The H-Code JS
reference has no local module loader and is not claimed as a third engine.

Count every repaired application module, original/new test, type declaration and
fixture-reader file as authored source. Report Unicode codepoints and UTF-8 bytes
separately, including alternate totals with both common JSON input files. Keep
generated runtime and external dependencies separate. The original twenty-task
registry, task18 sources and all earlier benchmark locks remain unchanged.
This one repair workload does not establish the global seventy-percent median.
