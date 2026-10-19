// M19.15 B1 demonstration: generic typed SQLite read, not a dashboard macro.
≔ rows=⧈⦃paidOrders:Number,region:String,revenueCents:Number⦄("orders.sqlite","SELECT region,COUNT(*) AS paidOrders,SUM(amount_cents) AS revenueCents FROM orders WHERE status=? AND day>=? AND day<? GROUP BY region ORDER BY revenueCents DESC,region COLLATE BINARY ASC",⟦"paid","2026-01-01","2026-02-01"⟧);
print(⤒rows);
