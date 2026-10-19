// Canonical15 B2 candidate: every query, aggregation and rendered HTML byte
// is authored in H-Code. No embedded dashboard runtime or fabricated DB data.
ƒ escape(s:String)→String {
 ≔chars←⫶s
 ≔i←0
 ≔out←""
 ⟳(i<⌗chars){
  ≔c←chars⟦i⟧
  ≔safe←c
  ⊢(c≡"&")⇒safe←"&amp;"
  ⊢(c≡"<")⇒safe←"&lt;"
  ⊢(c≡">")⇒safe←"&gt;"
  ⊢(c≡"\"")⇒safe←"&quot;"
  ⊢(c≡"'")⇒safe←"&#39;"
  out←out+safe
  i←i+1
 }
 ↩out
}
≔range←⤓⦃from:String,to:String⦄⌨
≔groups←⧈⦃paidOrders:Number,region:String,revenueCents:Number⦄(
 "orders.sqlite",
 "SELECT region,COUNT(*) AS paidOrders,SUM(amount_cents) AS revenueCents FROM orders WHERE status=? AND day>=? AND day<? GROUP BY region ORDER BY revenueCents DESC,region COLLATE BINARY ASC",
 ⟦"paid",range·from,range·to⟧
)
≔count←0
≔revenue←0
≔i←0
⟳(i<⌗groups){
 ≔g←groups⟦i⟧
 count←count+g·paidOrders
 revenue←revenue+g·revenueCents
 i←i+1
}
≔page←"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Database dashboard</title></head><body><main><h1>Paid orders dashboard</h1><p id=\"range\">"+escape(range·from)+" to "+escape(range·to)+" (exclusive)</p><p id=\"summary\" role=\"status\" aria-live=\"polite\">"+⤒count+" paid orders, "+⤒revenue+" minor units</p>"
⊢(⌗groups≡0)⇒page←page+"<p id=\"empty\">No paid orders in this period.</p>"
page←page+"<table id=\"results\"><caption>Paid orders and revenue by region</caption><thead><tr><th scope=\"col\">Region</th><th scope=\"col\">Paid orders</th><th scope=\"col\">Revenue (minor units)</th></tr></thead><tbody>"
i←0
⟳(i<⌗groups){
 ≔g←groups⟦i⟧
 page←page+"<tr><th scope=\"row\">"+escape(g·region)+"</th><td>"+⤒(g·paidOrders)+"</td><td>"+⤒(g·revenueCents)+"</td></tr>"
 i←i+1
}
page←page+"</tbody></table></main></body></html>"
print(page)
