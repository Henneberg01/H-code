// General typed empty-record rendering: preserve headers with zero rows.
≔rows:⟦⦃region:String,revenue:Number⦄⟧←⟦⟧
⟙("#results",rows)
