# H-Code empirical benchmark policy

**No speedup has been measured yet.** Symbols can reduce characters while increasing token count, cognitive load, or development effort. Benchmark complete working tasks, not just syntactic brevity.

## Categories

1. Syntax size: source bytes, nonblank source lines, package/dependency size, generated code footprint.
2. Developer speed: time to successful verified output including debugging and review.
3. AI efficiency: end-to-end model input/output tokens, retries, wall-clock duration, cost and human interventions.
4. Correctness: tests passed, functional equivalence, static defects, regression rate.
5. Runtime: CPU/wall time, allocations, peak memory, startup, output bundle and build time.
6. Portability and developer experience: install success, accessibility, reviewer comprehension and debugging tasks.

## Fair comparisons

- Competitor projects can use industry-standard libraries, templates, frameworks and automation, not boilerplate-only baselines.
- Execute each benchmark repeatedly; record environment, CPU, tool versions and variance.
- Keep training/prompt budgets comparable when testing AI.
- Separate handwritten H-Code from generated JavaScript; measure both.
- Report wins, regressions and unsupported cases. Do not claim global superiority based on one task family.

## First 20 benchmark workloads (planned)

1. Basic calculator CLI
2. Fibonacci recursion
3. Text frequency counter
4. CSV reader with validation
5. JSON transformation
6. HTTP client with retries
7. Local file conversion
8. Async concurrent request aggregation
9. Cache with expiration
10. Generic collection transforms
11. Markdown document processing
12. Basic CRUD API
13. Form validation UI
14. Interactive todo app
15. Database-backed dashboard
16. Authentication session handling
17. Simple WebSocket chat
18. Unit-test refactor task
19. Bug reproduction and repair task
20. Incremental feature on existing app

Only the first two are within the M1 reference interpreter's basic capability; it also runs small pure functions through offline symbol libraries. The others are future goals; they must not be marked passed.
