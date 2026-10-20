import "./report.hc" as reports
≔cases←⤓⟦⦃id:String,positive:String,summary:String,values:⟦Number⟧⦄⟧(⧄"cases.json")
≔i←0
⟳(i<⌗cases){
 ≔c←cases⟦i⟧
 ≔original←⤒c·values
 ⊨(reports∷report(c·values)≡c·summary)
 ⊨(reports∷positiveReport(c·values)≡c·positive)
 ⊨(⤒c·values≡original)
 i←i+1
}
