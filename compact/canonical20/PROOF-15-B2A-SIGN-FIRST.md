# M19.15 B2a — genuine typed records → table (development candidate)

The low-level four-argument ⟙(selector,caption,headers,rows) remains supported
for backwards compatibility. Its long, manually formatted text arrays are
**not** the preferred H-Code authoring experience.

The sign-first form is native typed H-Code ⟙(selector,records) where records
is a real, statically checked sequence of 1–16-field H-Code records with
String/Number/Bool fields. Rust checker generates an internal DomRecordTable
typed AST; the independent JavaScript interpreter implements the same effect.
The compiler derives actual column names and scalar-to-text conversions from
the *user's record type*, not a hardcoded domain/table macro.

Example H-Code:

    ≔r←⟦⦃region:"North",revenue:1200⦄,⦃region:"South",revenue:900⦄⟧
    ⟙("#results",r)

This works for any record names. All data are inert textContent nodes in
accessible THEAD/TBODY structures; no markup interpolation. Bounds and type
checks prevent unsafe cells. Both renderers also accept **typed empty records** with zero body rows.
The compiled Rust program uses its native static record type; the independent
interpreter preserves an explicit H-Code `⟦Record⟧` annotation on an empty
sequence. Unannotated empty sequences remain rejected rather than silently
inventing headings. This works without app-specific dashboard fallbacks.

This B2a contract is **not a complete database dashboard**: it has no
real database-backed Chromium integration, dynamic date range or grouping.
B2/B3 and source-equivalent standalone TypeScript benchmark are mandatory
before Canonical15 or a global 70% claim can be made. Full CI remains
necessary before merging.
