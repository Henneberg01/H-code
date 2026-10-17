# H-Code M5 — End-to-end application prototypes

## Delivered (2026-10-17)
Three real multi-file H-Code computation workflows implemented locally:

1. **Invoice** — m5/invoice/main.hc and rules.hc. Multiple lines, percent discount and VAT; fixture subtotal 6000 cents, discount 600 cents, VAT 1350 cents, final 6750 cents.
2. **Inventory replenishment** — m5/inventory/main.hc and rules.hc. Account for reserved stock, threshold and target, calculate order and cost; fixture reorder true, 22 units, cost 6578 cents.
3. **Savings projection** — m5/savings/main.hc and rules.hc. Loop across 3 periods at 10%; fixture balance 1331 from 1000.

## Validation
- Rust frontend tests: 15/15
- M3 JavaScript compiler tests: 8/8
- M4 local module tests: 6/6
- M5 integration tests: 2/2. Each app is typechecked, compiled, run, built to a JS .mjs file and verified against expected output using Node.js.
- M1 reference Node tests must remain green (independent of M5).

## Run
From the H-Code repository root:

    cargo run --manifest-path compiler/Cargo.toml -- run m5/invoice/main.hc
    cargo run --manifest-path compiler/Cargo.toml -- run m5/inventory/main.hc
    cargo run --manifest-path compiler/Cargo.toml -- run m5/savings/main.hc

## Honest scope and limitations
These are **complete runnable calculation examples**, not production apps: no persistent state, no database, no external APIs, no user input/UI and no authorization. Calculations are deterministic fixtures.

IMPORTANT: Invoice percentage calculations currently use Number (floating point). For production invoicing, implement exact integer/minor-unit arithmetic and explicit currency rounding before accepting real transactions; values in the current fixtures are exact integers. No financial correctness certification is implied.

Generated JS still lacks a safe execution-step cap/sandbox for untrusted H-Code. M5 changes are local only and have not been synced to GitHub.
