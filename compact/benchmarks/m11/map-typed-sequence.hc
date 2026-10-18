ƒ twiceEach(xs:⟦Number⟧) → ⟦Number⟧ {≔ out:⟦Number⟧←⟦⟧;≔ i←0;while(i<⌗xs){out←out ⧺ ⟦xs⟦i⟧*2⟧;i←i+1;}↩ out;}≔ ys←twiceEach(⟦10,11⟧);print(ys⟦0⟧);print(ys⟦1⟧);
