ƒ output(s:String,m:⟦⦃client:String,data:String⦄⟧)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄↩⦃messages:m,state:s⦄
ƒ one(s:String,c:String,d:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄↩output(s,⟦⦃client:c,data:d⦄⟧)
ƒ error(s:String,c:String,m:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄↩one(s,c,⤒⦃error:m,kind:"error"⦄)
ƒ chat(e:⦃client:String,data:String,kind:String⦄,s:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄{
 ≔state←⤓⦃members:⟦⦃client:String,room:String⦄⟧,sequence:Number⦄s
 ⊢(e·kind≡"open")⇒↩one(⤒(state⊞members:(state·members⧺⟦⦃client:e·client,room:""⦄⟧)),e·client,⤒⦃client:e·client,kind:"ready"⦄)
 ⊢(e·kind≡"close")⇒↩output(⤒(state⊞members:(state·members⌕λm:m·client≠e·client)),⟦⟧)
 ⊢(¬⤔⦃kind:String,value:String⦄e·data)⇒↩error(s,e·client,"invalid")
 ≔input←⤓⦃kind:String,value:String⦄e·data
 ≔length←⌗(⫶input·value)
 ⊢((input·kind≠"join"∧input·kind≠"say")∨length<1∨length>(input·kind≡"join"◇32:1024))⇒↩error(s,e·client,"invalid")
 ⊢(input·kind≡"join"){
  ≔members←state·members⇢λm:m·client≡e·client◇(m⊞room:input·value):m
  ↩one(⤒(state⊞members:members),e·client,⤒⦃kind:"joined",members:⌗(members⌕λm:m·room≡input·value),room:input·value⦄)
 }
 ≔own←(state·members⌕λm:m·client≡e·client)⟦0⟧
 ⊢(own·room≡"")⇒↩error(s,e·client,"not_joined")
 ⊢(state·sequence≥9007199254740991)⇒↩error(s,e·client,"exhausted")
 ≔sequence←state·sequence+1
 ≔message←⤒⦃kind:"message",room:own·room,sender:e·client,sequence:sequence,text:input·value⦄
 ↩output(⤒(state⊞sequence:sequence),(state·members⌕λm:m·room≡own·room)⇢λm:⦃client:m·client,data:message⦄)
}
≔members:⟦⦃client:String,room:String⦄⟧←⟦⟧
⇄(chat,⤒⦃members:members,sequence:0⦄)
