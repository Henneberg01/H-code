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
ƒ sortRevenue(rs:⟦⦃paidOrders:Number,region:String,revenueCents:Number⦄⟧)→⟦⦃paidOrders:Number,region:String,revenueCents:Number⦄⟧ {
 ≔remaining←rs
 ≔sorted:⟦⦃paidOrders:Number,region:String,revenueCents:Number⦄⟧←⟦⟧
 ⟳(⌗remaining>0){
  ≔best←remaining⟦0⟧
  ≔i←1
  ⟳(i<⌗remaining){
   ≔candidate←remaining⟦i⟧
   ⊢(candidate·revenueCents>best·revenueCents)⇒best←candidate
   i←i+1
  }
  sorted←sorted⧺⟦best⟧
  remaining←remaining⌕λr:r·region≠best·region
 }
 ↩sorted
}
≔result←⦃paidOrders:count,revenueCents:revenue,byRegion:sortRevenue(grouped)⦄
print(⤒result)
