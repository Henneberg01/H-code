# Canonical task 20: interval reports on the existing reporting project

The unchanged preregistration requires: **extend frozen starter app while
retaining all prior behavior and passing new acceptance**. It originally fixed
this brief, not a concrete application or feature. This fixture is established
on 2026-10-20, derived from task18's reporting modules and tests at commit
c24ba245f85c266ec7337ced08706c6cf3b8731a. It is not a historical task20 snapshot.

The starter copies the existing summarize/positiveSummary/report/positiveReport
modules and assertions byte for byte. A small CLI entry point established in
this starter reads a finite JSON number array from stdin and prints the ordinary
and positive reports on separate lines. The TypeScript starter includes explicit
input validation; H-Code uses its typed JSON reader. Old modules, entry point,
old test bytes, original twelve cases and CLI outcomes must be preserved.

The feature adds rangeSummary(values, lower, upper) and rangeReport with an
inclusive lower/upper interval. Reversed bounds and intervals without values
return the existing all-zero empty summary. Equal bounds include matching
values. Input order and input arrays remain unchanged. Finite numeric input is
the contract; summaries retain count/maximum/mean/minimum/total JSON field order.
A separate range CLI accepts {values,lower,upper} JSON, validates its shape and
prints one range report. The old entry point and output protocol stay unchanged.
Malformed JSON, missing/wrong-type/nonfinite fields and invalid UTF-8 must exit
nonzero with empty stdout and a nonempty diagnostic. Exact diagnostics are not
required to match across languages. Neither stdin limit nor every IEEE-754
extreme is a claim of this fixture.

Before implementing the feature, freeze the starter, original data, acceptance
test sources, ten interval cases, this contract and an observed old-CLI outcome
snapshot. Commit them before writing the extended variant. Show the new tests
fail on the starter because the feature is absent. Then run all old/new tests,
CLI integration with both actual runtimes, additional generated cases, and
counterfactual defects in both the old behavior and new interval boundaries.

All delivered source, modules, tests, type/input helpers and CLI entries count
as authored Unicode codepoints and UTF-8 bytes. Shared JSON fixtures and frozen
CLI outcomes are separate and also shown in inclusive totals. Generated native
runtime is separate. No app-specific compiler changes or hidden native adapter
may implement the feature. Measure the whole extended project, not merely its
diff. This proves only task20; the original twenty-task denominator, earlier
sources and the global 70% target are unchanged. The independent JS reference
has no local module loader and is not claimed as a third engine.
