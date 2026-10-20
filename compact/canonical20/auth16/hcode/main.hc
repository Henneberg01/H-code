≔key←⧄"signing-key.txt"
≔keyLength←⌗(⫶key)
⊨(keyLength≥32∧keyLength≤1024)
ƒ claims(g:Number)→String↩⤒⦃generation:g,identity:"fixture-alice"⦄
ƒ reply(s:String,code:Number,body:String)→⦃body:String,contentType:String,state:String,status:Number⦄
 ↩⦃body:code≡204◇"":body+"\n",contentType:"application/json; charset=utf-8",state:s,status:code⦄
ƒ error(s:String,code:Number,message:String)→⦃body:String,contentType:String,state:String,status:Number⦄↩reply(s,code,⤒⦃error:message⦄)
ƒ issued(g:Number,code:Number)→⦃body:String,contentType:String,state:String,status:Number⦄
 ↩reply(⤒⦃generation:g,revoked:⊥⦄,code,⤒⦃generation:g,identity:"fixture-alice",signature:✍(key,claims(g))⦄)
ƒ serve(r:⦃body:String,contentType:String,headers:⟦⦃name:String,value:String⦄⟧,method:String,path:String⦄,s:String)→⦃body:String,contentType:String,state:String,status:Number⦄ {
 ⊢(⌗(r·headers⌕λh:h·name≡"x-hcode-request-id")>0)⇒↩error(s,400,"idempotency_not_supported")
 ⊢(r·path≠"/session"∧r·path≠"/session/rotate"∧r·path≠"/session/revoke")⇒↩error(s,404,"not_found")
 ⊢((r·path≡"/session"∧r·method≠"GET"∧r·method≠"POST")∨(r·path≠"/session"∧r·method≠"POST"))⇒↩error(s,405,"method_not_allowed")
 ≔state←⤓⦃generation:Number,revoked:Bool⦄s
 ⊢(state·generation<0∨state·generation>9007199254740991∨state·generation%1≠0)⇒↩error(s,500,"invalid_state")
 ⊢(r·path≡"/session"∧r·method≡"POST"){
  ⊢((r·contentType≠"application/json"∧r·contentType≠"application/json; charset=utf-8")∨⌗(r·headers⌕λh:h·name≡"content-type")≠1)⇒↩error(s,400,"invalid")
  ⊢(¬⤔⦃credential:String,identity:String⦄r·body)⇒↩error(s,400,"invalid")
  ≔credentials←⤓⦃credential:String,identity:String⦄r·body
  ⊢(credentials·identity≠"fixture-alice"∨credentials·credential≠"fixture-password")⇒↩error(s,401,"unauthorized")
  ⊢(state·generation≥9007199254740991)⇒↩error(s,409,"generation_exhausted")
  ↩issued(state·generation+1,201)
 }
 ⊢(r·body≠"")⇒↩error(s,400,"invalid")
 ≔signatures←r·headers⌕λh:h·name≡"x-session-signature"
 ⊢(⌗signatures≠1)⇒↩error(s,401,"unauthorized")
 ⊢(state·revoked∨¬✓(key,claims(state·generation),signatures⟦0⟧·value))⇒↩error(s,401,"unauthorized")
 ⊢(r·method≡"GET")⇒↩reply(s,200,claims(state·generation))
 ⊢(r·path≡"/session/rotate"){
  ⊢(state·generation≥9007199254740991)⇒↩error(s,409,"generation_exhausted")
  ↩issued(state·generation+1,200)
 }
 ↩reply(⤒⦃generation:state·generation,revoked:⊤⦄,204,"")
}
⤊(serve,⤒⦃generation:0,revoked:⊤⦄)
