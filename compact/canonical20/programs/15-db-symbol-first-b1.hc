// Real typed SQLite rows, filtered and mapped with H-Code signs. No authored SQL.
≔r←⧈⦃amount_cents:Number,day:String,region:String,status:String⦄("orders.sqlite","orders")
≔p←r⌕λx:x·status≡"paid"∧x·day≥"2026-01-01"∧x·day<"2026-02-01"
⎙(⤒(p⇢λx:⦃amount:x·amount_cents,region:x·region⦄))
