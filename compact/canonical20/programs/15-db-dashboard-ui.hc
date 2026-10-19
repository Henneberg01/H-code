// Canonical15 B2b browser: real developer-authored H-Code view of SQLite results.
// The server independently invokes 15-db-dashboard-b2b.hc against actual SQLite.
// Browser has no database/OS permission. Untrusted names remain text in a table.
≔d←⤓⦃byRegion:⟦⦃paidOrders:Number,region:String,revenueCents:Number⦄⟧,paidOrders:Number,revenueCents:Number⦄⟐("#payload")
⟑("#summary",⤒(d·paidOrders)+" paid orders, "+⤒(d·revenueCents)+" minor units")
⟙("#results","Paid orders and revenue by region",
 ⟦"Region","Paid orders","Revenue (minor units)"⟧,
 d·byRegion⇢λx:⟦x·region,⤒(x·paidOrders),⤒(x·revenueCents)⟧)
⊢(d·paidOrders≡0)⇒⟑("#empty","No paid orders in this period.")
