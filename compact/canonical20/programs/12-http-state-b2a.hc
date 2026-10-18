ƒ reply(r:⦃body:String,method:String,path:String⦄,state:String)→⦃body:String,state:String,status:Number⦄ {
  ⊢(r.method≡"POST"∧r.path≡"/inc"){
    ≔next←⤒(⩚state+1)
    ↩⦃body:next,state:next,status:200⦄
  }
  ↩⦃body:state,state:state,status:200⦄
}
⤊(reply,"0")
