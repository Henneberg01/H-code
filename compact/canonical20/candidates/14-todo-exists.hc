// Canonical14 candidate: interactive, persistent todo program written in H-Code.
// All add/complete/remove logic is H-Code, not a special runtime todo macro.
ƒ valid(t:String)→Bool {
 ≔c←⫶t
 ⊢(⌗c<1∨⌗c>128)⇒↩⊥
 ↩c∃λx:x≠" "∧x≠"\t"∧x≠"\n"∧x≠"\r"
}
ƒ load()→⟦⦃title:String,done:Bool⦄⟧ {
 ≔raw←⟕("hcode:todos")
 ⊢(raw≡""){
  ≔none:⟦⦃title:String,done:Bool⦄⟧←⟦⟧
  ↩none
 }
 ↩⤓⟦⦃title:String,done:Bool⦄⟧raw
}
≔tasks←load()
ƒ draw()→Bool {
 ⟘("#todo-list",tasks⇢λx:(x·done?"✓ ":"○ ")+x·title)
 ⟑("#summary",⤒(⌗(tasks⌕λx:¬x·done))+" tasks remaining")
 ↩⊤
}
ƒ add(v:String)→Bool {
 ≔name←⟐("#todo-input")
 ⊢(¬valid(name)){
  ⟑("#status","Enter a task name (up to 128 characters)")
  ↩⊥
 }
 ⊢(tasks∃λx:x·title≡name){
  ⟑("#status","Task already exists")
  ↩⊥
 }
 ≔next←tasks⧺⟦⦃title:name,done:⊥⦄⟧
 ⟖("hcode:todos",⤒next)
 tasks←next
 draw()
 ⟑("#status","Added "+name)
 ↩⊤
}
ƒ complete(v:String)→Bool {
 ≔name←⟐("#todo-input")
 ⊢(¬(tasks∃λx:x·title≡name)){
  ⟑("#status","Task not found")
  ↩⊥
 }
 ≔next←tasks⇢λx:x·title≡name?⦃title:x·title,done:⊤⦄:x
 ⟖("hcode:todos",⤒next)
 tasks←next
 draw()
 ⟑("#status","Completed "+name)
 ↩⊤
}
ƒ remove(v:String)→Bool {
 ≔name←⟐("#todo-input")
 ⊢(¬(tasks∃λx:x·title≡name)){
  ⟑("#status","Task not found")
  ↩⊥
 }
 ≔next←tasks⌕λx:x·title≠name
 ⟖("hcode:todos",⤒next)
 tasks←next
 draw()
 ⟑("#status","Removed "+name)
 ↩⊤
}
draw()
⟓("#add","click",add)
⟓("#complete","click",complete)
⟓("#remove","click",remove)
