≔values←⟦3,-2,7⟧
⊨(values∃(<0))
≔users←⟦⦃name:"Ada",active:⊥⦄,⦃name:"Bo",active:⊤⦄⟧
⊨(users∃λuser:user·active)
≔empty:⟦Number⟧←⟦⟧
⊨(¬(empty∃(>0)))
⎙("JFH-CODE ∃ checks passed")
