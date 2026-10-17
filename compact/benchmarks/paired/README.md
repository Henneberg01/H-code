# CSE-1 preliminary H-Code / TypeScript parity samples

Two handwritten programs, not the project's canonical 20-program target and not representative of typical applications.

- `typed-function`: one typed arithmetic function.
- `chained-functions`: two ordinary typed arithmetic functions composed in a call chain.

Run `npm run compact:ts-parity` from repository root with Node 22+ and Rust stable installed. It uses Node's TypeScript type stripping and compiles H-Code through the real Rust `hcodec` CLI, then checks **exact output parity** before producing a measured code-point/UTF-8 comparison.

The task deliberately gives TypeScript ordinary concise, idiomatic arrow functions and core `console.log`. It does not pad TypeScript with needless boilerplate or omit handwritten H-Code source. Dependencies, generated bundles and runtime resources are **not accounted for** by this preliminary script, so none of these figures count toward the final research objective.

If either side fails, the script fails rather than publishing numbers. Results must be independently reviewed. The full 20-task benchmark requires many later H-Code language and library milestones.
