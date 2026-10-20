import "./statistics.hc" as stats
import "./report.hc" as reports
≔cases←⤓⟦⦃id:String,values:⟦Number⟧,lower:Number,upper:Number,expected:String⦄⟧(⧄"ranges.json")
≔i←0
⟳(i<⌗cases){
 ≔c←cases⟦i⟧
 ≔original←⤒c·values
 ⊨(⤒stats∷rangeSummary(c·values,c·lower,c·upper)≡c·expected)
 ⊨(reports∷rangeReport(c·values,c·lower,c·upper)≡c·expected)
 ⊨(⤒c·values≡original)
 i←i+1
}
