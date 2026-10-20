import "./core.hc" as core
export ƒ summarize(values:⟦Number⟧)↩core∷summarize(values)
export ƒ positiveSummary(values:⟦Number⟧)↩core∷summarize(values⌕(>0))
export ƒ rangeSummary(values:⟦Number⟧,lower:Number,upper:Number)↩core∷summarize(values⌕λx:x≥lower∧x≤upper)
