export ƒ summarize(values:⟦Number⟧)→⦃count:Number,maximum:Number,mean:Number,minimum:Number,total:Number⦄{
 ≔count←⌗values
 ≔total←∑values
 ≔minimum←count>0◇values⟦0⟧:0
 ≔maximum←minimum
 ≔i←1
 ⟳(i<count){
  ≔value←values⟦i⟧
  minimum←value<minimum◇value:minimum
  maximum←value>maximum◇value:maximum
  i←i+1
 }
 ↩⦃count:count,maximum:maximum,mean:count>0◇total/count:0,minimum:minimum,total:total⦄
}
