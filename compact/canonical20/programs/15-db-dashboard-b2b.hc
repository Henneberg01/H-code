// Canonical15 B2b: the actual query, grouping, aggregation and sorting are H-Code.
// Data is a real pre-existing SQLite file; permissions are explicit, not mocked.
// stdin: a JSON record {"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}.
≔range←⤓⦃from:String,to:String⦄⌨
≔orders←⧈⦃amountCents:Number,region:String⦄("orders.sqlite",
 "SELECT amount_cents AS amountCents,region FROM orders WHERE status=? AND day>=? AND day<? ORDER BY id",
 ⟦"paid",range·from,range·to⟧)
≔count←⌗orders
≔revenue←∑(orders⇢λr:r·amountCents)
≔regions←⧉(orders⇢λr:r·region)
≔grouped←regions⇢λg:⦃region:g·value,paidOrders:g·count,revenueCents:∑((orders⌕λr:r·region≡g·value)⇢λr:r·amountCents)⦄
// Stable numeric descending order using a reusable H-Code operation.
≔result←⦃paidOrders:count,revenueCents:revenue,byRegion:grouped↧λg:g·revenueCents⦄
⎙(⤒result)
