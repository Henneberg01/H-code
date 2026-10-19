const email=document.querySelector<HTMLInputElement>('#email');
const form=document.querySelector<HTMLFormElement>('#contact-form');
const preview=document.querySelector<HTMLOutputElement>('#email-preview');
const error=document.querySelector<HTMLElement>('#email-error');
if(!email||!form||!preview||!error)throw Error('Missing form controls');
function validate():boolean {
  preview.textContent=email.value;
  const ok=email.checkValidity();
  email.setAttribute('aria-invalid',ok?'false':'true');
  error.textContent=ok?'':'Enter a valid email address';
  return ok;
}
email.addEventListener('input',()=>{validate();});
form.addEventListener('submit',event=>{if(!validate())event.preventDefault();});
