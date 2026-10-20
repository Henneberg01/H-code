import "./statistics.hc" as stats
import "./report.hc" as reports
≔cases←⤓⟦⦃id:String,positive:String,summary:String,values:⟦Number⟧⦄⟧(⧄"regression.json")
≔i←0
⟳(i<⌗cases){
 ≔c←cases⟦i⟧
 ≔original←⤒c·values
 ⊨(⤒stats∷summarize(c·values)≡c·summary)
 ⊨(⤒stats∷positiveSummary(c·values)≡c·positive)
 ⊨(reports∷report(c·values)≡c·summary)
 ⊨(reports∷positiveReport(c·values)≡c·positive)
 ⊨(⤒c·values≡original)
 i←i+1
}
