// M19.12 B3b-2: routes, validation and mutations are user-authored H-Code.
// This is deliberately NOT an app-specific compiler/runtime macro.
ƒ has(s:String,xs:⟦String⟧)→Bool ↩⌗(xs⌕λx:x≡s)>0
ƒ validID(s:String)→Bool {
 ≔c←⫶s
 ⊢(⌗c<1∨⌗c>32)⇒↩⊥
 ≔a←⟦"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"⟧
 ≔b←a⧺⟦"0","1","2","3","4","5","6","7","8","9","-"⟧
 ⊢(¬has(c⟦0⟧,a))⇒↩⊥
 ↩⌗(c⌕λx:¬has(x,b))≡0
}
ƒ validName(s:String)→Bool {
 ≔c←⫶s
 ⊢(⌗c<1∨⌗c>128)⇒↩⊥
 ↩⌗(c⌕λx:x≠" "∧x≠"\t"∧x≠"\n"∧x≠"\r")>0
}
ƒ validQty(v:Number)→Bool ↩v>=0∧v<=10000∧v%1≡0
ƒ validVersion(v:Number)→Bool ↩v>0∧v<9007199254740991∧v%1≡0
ƒ pathTail(c:⟦String⟧,i:Number)→String {
 ⊢(i>=⌗c)⇒↩""
 ↩c⟦i⟧+pathTail(c,i+1)
}
ƒ err(s:String,code:Number,msg:String)→⦃body:String,contentType:String,state:String,status:Number⦄
 ↩⦃body:⤒⦃error:msg⦄+"\n",contentType:"application/json; charset=utf-8",state:s,status:code⦄
ƒ ok(s:String,code:Number,v:⦃id:String,name:String,qty:Number,version:Number⦄)→⦃body:String,contentType:String,state:String,status:Number⦄
 ↩⦃body:⤒v+"\n",contentType:"application/json; charset=utf-8",state:s,status:code⦄
ƒ deleted(s:String)→⦃body:String,contentType:String,state:String,status:Number⦄
 ↩⦃body:"",contentType:"application/json; charset=utf-8",state:s,status:204⦄
ƒ serve(r:⦃body:String,contentType:String,method:String,path:String⦄,s:String)→⦃body:String,contentType:String,state:String,status:Number⦄ {
 ≔xs←⤓⟦⦃id:String,name:String,qty:Number,version:Number⦄⟧s
 ⊢(r.path≡"/items"){
  ⊢(r.method≠"POST")⇒↩err(s,405,"method_not_allowed")
  ⊢(⌗(⫶r.body)>16384)⇒↩err(s,413,"too_large")
  ⊢(r.contentType≠"application/json"∧r.contentType≠"application/json; charset=utf-8")⇒↩err(s,400,"invalid")
  ⊢(¬⤔⦃id:String,name:String,qty:Number⦄r.body)⇒↩err(s,400,"invalid")
  ≔b←⤓⦃id:String,name:String,qty:Number⦄r.body
  ⊢(¬validID(b·id)∨¬validName(b·name)∨¬validQty(b·qty))⇒↩err(s,400,"invalid")
  ⊢(⌗(xs⌕λx:x·id≡b·id)>0)⇒↩err(s,409,"conflict")
  ≔v←⦃id:b·id,name:b·name,qty:b·qty,version:1⦄
  ↩ok(⤒(xs⧺⟦v⟧),201,v)
 }
 ≔c←⫶r.path
 ⊢(⌗c<8)⇒↩err(s,404,"not_found")
 ⊢(c⟦0⟧≠"/"∨c⟦1⟧≠"i"∨c⟦2⟧≠"t"∨c⟦3⟧≠"e"∨c⟦4⟧≠"m"∨c⟦5⟧≠"s"∨c⟦6⟧≠"/")⇒↩err(s,404,"not_found")
 ⊢(⌗c>39)⇒↩err(s,400,"invalid")
 ≔id←pathTail(c,7)
 ⊢(¬validID(id))⇒↩err(s,400,"invalid")
 ⊢(r.method≠"GET"∧r.method≠"PUT"∧r.method≠"DELETE")⇒↩err(s,405,"method_not_allowed")
 ≔found←xs⌕λx:x·id≡id
 ⊢(r.method≡"PUT"){
  ⊢(⌗(⫶r.body)>16384)⇒↩err(s,413,"too_large")
  ⊢(r.contentType≠"application/json"∧r.contentType≠"application/json; charset=utf-8")⇒↩err(s,400,"invalid")
  ⊢(¬⤔⦃name:String,qty:Number,version:Number⦄r.body)⇒↩err(s,400,"invalid")
  ≔b←⤓⦃name:String,qty:Number,version:Number⦄r.body
  ⊢(¬validName(b·name)∨¬validQty(b·qty)∨¬validVersion(b·version))⇒↩err(s,400,"invalid")
  ⊢(⌗found≡0)⇒↩err(s,404,"not_found")
  ≔old←found⟦0⟧
  ⊢(old·version≠b·version)⇒↩err(s,409,"conflict")
  ≔v←⦃id:id,name:b·name,qty:b·qty,version:old·version+1⦄
  ≔ys←xs⇢λx:x·id≡id?v:x
  ↩ok(⤒ys,200,v)
 }
 ⊢(⌗found≡0)⇒↩err(s,404,"not_found")
 ⊢(r.method≡"GET")⇒↩ok(s,200,found⟦0⟧)
 ↩deleted(⤒(xs⌕λx:x·id≠id))
}
⤊(serve,"[]")
