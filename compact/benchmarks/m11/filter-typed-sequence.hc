ƒ positives(xs:⟦Number⟧) → ⟦Number⟧ {≔ out:⟦Number⟧←⟦⟧;≔ i←0;while(i<⌗xs){if(xs⟦i⟧>0){out←out ⧺ ⟦xs⟦i⟧⟧;}i←i+1;}↩ out;}≔ ys←positives(⟦-1,2,3,-2⟧);print(⌗ys);print(ys⟦0⟧);print(ys⟦1⟧);
