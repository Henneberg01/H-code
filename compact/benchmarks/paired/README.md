# H-Code / idiomatic TypeScript — eight-case interim corpus

This is an honest *interim* research benchmark, **not** the canonical 20-task corpus, not proof of the 70% goal, and not a representative study of complete applications.

The eight implemented case IDs are: `typed-function`, `chained-functions`, `recursive-fibonacci`, `counter-loop`, `string-greeting`, `boolean-check`, `recursive-factorial`, `conditional-branch`.

They intentionally cover success cases **and** cases where contemporary TypeScript syntax is shorter (native for loops, ternary expressions, recursive functions). No padding, minification, hidden task-specific libraries or omitted source files.

Run `npm run compact:ts-parity` with Node 22+ and Rust cargo installed. It runs both sides and checks *exact stdout parity* before reporting results. It reports Unicode code-point counts, UTF-8-byte counts and median reduction, including negative percentages.

Limits: Eight simple programs, one toolchain, no independent reviewer, no complete dependency/build-size accounting, no AI token or developer-time measurements. A future 20-task benchmark must include real programs requiring lists, records, networking and other general-language features. Outputs are preliminary until the actual Rust compiler test runner is green.
