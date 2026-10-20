import "./statistics.hc" as stats
≔cases←⤓⟦⦃id:String,positive:String,summary:String,values:⟦Number⟧⦄⟧(⧄"cases.json")
≔i←0
⟳(i<⌗cases){
 ≔c←cases⟦i⟧
 ≔original←⤒c·values
 ⊨(⤒stats∷summarize(c·values)≡c·summary)
 ⊨(⤒stats∷positiveSummary(c·values)≡c·positive)
 ⊨(⤒c·values≡original)
 i←i+1
}
