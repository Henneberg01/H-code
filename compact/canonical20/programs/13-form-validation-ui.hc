// Canonical13 B1 candidate: all behavior belongs to developer-written H-Code.
// The native HTML5 required/email rules are supplied by actual browser controls.
ƒ validate(v:String)→Bool {
  ⟑("#email-preview",⟐("#email"))
  ≔ok←⟒("#email")
  ⟔("#email","aria-invalid",ok?"false":"true")
  ⟑("#email-error",ok?"":"Enter a valid email address")
  ↩ok
}
⟓("#email","input",validate)
⟓("#contact-form","submit",validate)
