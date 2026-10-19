// Trusted-host command interface. HTTP identity/clock integration remains B2b.
// All session policy lives here; ⥁ is a general atomic String transition.
ƒ alphabet(s:String,allowed:String,lo:Number,hi:Number)→Bool {
 ≔c←⫶s
 ⊢(⌗c<lo∨⌗c>hi)⇒↩⊥
 ≔a←⫶allowed
 ↩⌗(c⌕λx:⌗(a⌕λy:y≡x)≡0)≡0
}
ƒ time(n:Number)→Bool ↩n≥0∧n≤9007199254740991∧n%1≡0
ƒ decode(t:String)→String {
 ≔c←⫶t
 ⊢(⌗c<71∨⌗c>112)⇒↩""
 ⊢(c⟦0⟧≠"v"∨c⟦1⟧≠"1"∨c⟦2⟧≠".")⇒↩""
 ≔id←""
 ≔mac←""
 ≔part←0
 ≔i←3
 ⟳(i<⌗c){
  ≔x←c⟦i⟧
  ⊢(x≡"."){part←part+1}⊣{⊢(part≡0){id←id+x}⊣{mac←mac+x}}
  i←i+1
 }
 ⊢(part≠1∨¬alphabet(id,"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-",24,64))⇒↩""
 ⊢(¬⊨("session","hcode-session/v1/"+id,mac))⇒↩""
 ↩id
}
ƒ failed(s:String,e:String)→⦃state:String,value:String⦄
 ↩⦃state:s,value:⤒⦃ok:⊥,identity:"",issuedAt:0,expiresAt:0,token:"",cookie:"",error:e⦄⦄
ƒ result(s:String,u:String,a:Number,e:Number,t:String,ttl:Number)→⦃state:String,value:String⦄ {
 ≔cookie←""
 ⊢(t≠""){cookie←"__Host-hcode_session="+t+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+(⤒ttl)}
 ↩⦃state:s,value:⤒⦃ok:⊤,identity:u,issuedAt:a,expiresAt:e,token:t,cookie:cookie,error:""⦄⦄
}
≔q←⤓⦃op:String,identity:String,token:String,now:Number,ttl:Number⦄⌨
ƒ transition(s:String)→⦃state:String,value:String⦄ {
 ⊢(¬time(q·now))⇒↩failed(s,"invalid")
 ≔xs←⤓⟦⦃h:String,u:String,a:Number,e:Number,r:Number⦄⟧s
 ⊢(q·op≡"issue"){
  ⊢(¬alphabet(q·identity,"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.:-",1,128))⇒↩failed(s,"invalid")
  ⊢(q·ttl<1∨q·ttl>86400∨q·ttl%1≠0∨¬time(q·now+q·ttl))⇒↩failed(s,"invalid")
  ⊢(⌗xs≥1024)⇒↩failed(s,"capacity")
  ≔id←⚄18
  ≔h←⌁id
  ⊢(⌗(xs⌕λx:x·h≡h)>0)⇒↩failed(s,"conflict")
  ≔t←"v1."+id+"."+⊩("session","hcode-session/v1/"+id)
  ≔row←⦃h:h,u:q·identity,a:q·now,e:q·now+q·ttl,r:-1⦄
  ↩result(⤒(xs⧺⟦row⟧),row·u,row·a,row·e,t,q·ttl)
 }
 ⊢(q·op≠"inspect"∧q·op≠"rotate"∧q·op≠"revoke")⇒↩failed(s,"invalid")
 ≔id←decode(q·token)
 ⊢(id≡"")⇒↩failed(s,"invalid")
 ≔h←⌁id
 ≔found←xs⌕λx:x·h≡h∧x·r≡-1∧q·now<x·e
 ⊢(⌗found≠1)⇒↩failed(s,"invalid")
 ≔old←found⟦0⟧
 ⊢(q·op≡"inspect")⇒↩result(s,old·u,old·a,old·e,"",0)
 ⊢(q·op≡"revoke"){
  ≔ys←xs⇢λx:x·h≡h?⦃h:x·h,u:x·u,a:x·a,e:x·e,r:q·now⦄:x
  ↩result(⤒ys,old·u,old·a,old·e,"",0)
 }
 ⊢(⌗xs≥1024)⇒↩failed(s,"capacity")
 ≔next←⚄18
 ≔hash←⌁next
 ⊢(⌗(xs⌕λx:x·h≡hash)>0)⇒↩failed(s,"conflict")
 ≔ys←xs⇢λx:x·h≡h?⦃h:x·h,u:x·u,a:x·a,e:x·e,r:q·now⦄:x
 ≔row←⦃h:hash,u:old·u,a:q·now,e:old·e,r:-1⦄
 ≔t←"v1."+next+"."+⊩("session","hcode-session/v1/"+next)
 ↩result(⤒(ys⧺⟦row⟧),row·u,row·a,row·e,t,row·e-q·now)
}
⎙(⥁(transition,"[]"))
