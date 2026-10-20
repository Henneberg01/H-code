import "./statistics.hc" as stats
export ƒ report(values:⟦Number⟧)→String↩⤒stats∷summarize(values)
export ƒ positiveReport(values:⟦Number⟧)→String↩⤒stats∷positiveSummary(values)
export ƒ rangeReport(values:⟦Number⟧,lower:Number,upper:Number)→String↩⤒stats∷rangeSummary(values,lower,upper)
