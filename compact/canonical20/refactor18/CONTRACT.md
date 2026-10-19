# Canonical task 18: preserve behavior while extracting reusable logic

The original, unchanged twenty-workload registry requires: **refactor a frozen
baseline without modifying its required behavior or assertions**. It originally
registered a task brief, not a concrete starter project. This numerical-summary
project is a new, explicitly dated fixture established on 2026-10-19; it is not
presented as a pre-existing historical source snapshot.

The baseline has two public statistics functions, `summarize(values)` and
`positiveSummary(values)`, and two report functions, `report(values)` and
`positiveReport(values)`. Both statistics return a record with `count`, `maximum`,
`mean`, `minimum` and `total`. Empty input returns zeros in all fields. Positive
means strictly greater than zero. Reports serialize exactly those fields in
that order to JSON. Inputs must not be mutated. Inputs in this task are finite
numeric arrays; this fixture does not specify a universal floating-point model.

The refactor must extract the common statistics implementation into a reusable
module and replace the duplicated positive-data implementation with composition.
Public names, argument/return shapes, outputs and assertion source bytes must
remain unchanged. Both actual projects must compile and execute through the
native compiler and test runner. The independent idiomatic TypeScript project
must pass exactly the same frozen data and expected outputs.

Twelve fixed inputs cover empty, singleton, negative-only, all-zero, mixed,
duplicates, fractions, large/small values, equal extrema, zero totals and input
order. Two test files exercise both pure statistics and transitive report-module
imports, with six assertions per input across the files (72 in total). A frozen
JSON file contains the language-neutral input and expected-output data. The
proof must also run additional deterministic inputs and reject deliberately
broken implementations, rather than accepting an exit status alone.

The baseline and its tests are source-locked and committed before the refactored
variant is written. Application modules and test source count toward authored
Unicode codepoints and UTF-8 bytes; all support/type files count as well. Shared
fixture JSON bytes and generated runtime bytes are reported separately, with
source totals including the shared fixture also reported for transparency.
No application-specific compiler feature is permitted for this task.

This contract implements only the original refactor workload. It does not
change the twenty-workload registry, remove other workloads, or establish the
global 70% target. The independent H-Code JS reference currently has no local
module loader and is not counted as a third execution engine for this proof.
