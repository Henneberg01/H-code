// M19.15 B4 candidate — complete dashboard logic in H-Code signs, no SQL source.
≔range←⤓⦃from:String,to:String⦄⌨
≔orders←⧈⦃amount_cents:Number,day:String,region:String,status:String⦄("orders.sqlite","orders")
≔paid←orders⌕λr:r·status≡"paid"∧r·day≥range·from∧r·day<range·to
≔count←⌗paid
≔revenue←∑(paid⇢λr:r·amount_cents)
≔regions←⧉(paid⇢λr:r·region)
≔grouped←regions⇢λg:⦃region:g·value,paidOrders:g·count,revenueCents:∑((paid⌕λr:r·region≡g·value)⇢λr:r·amount_cents)⦄
≔sorted←(grouped↥λg:g·region)↧λg:g·revenueCents
≔result←⦃paidOrders:count,revenueCents:revenue,byRegion:sorted⦄
⎙(⤒result)
