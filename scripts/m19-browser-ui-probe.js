// Independent browser observation, shared by both compared programs.
// Interactions are real DOM events; no program-specific expected responses.
window.addEventListener('load',()=>{
  const email=document.querySelector('#email');
  const form=document.querySelector('#contact-form');
  const error=document.querySelector('#email-error');
  const preview=document.querySelector('#email-preview');
  const trace=[];
  const capture=stage=>({
    stage,
    aria:email.getAttribute('aria-invalid'),
    message:error.textContent,
    text:preview.textContent,
    html:preview.innerHTML,
    nativeValid:email.checkValidity()
  });
  try{
    email.value='not-an-email';
    email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    const invalid=new Event('submit',{bubbles:true,cancelable:true});
    form.dispatchEvent(invalid);
    trace.push({...capture('invalid'),cancelled:invalid.defaultPrevented});

    email.value='<img src=x onerror=alert(1)>';
    email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    trace.push({...capture('html-injection'),createdImage:document.querySelector('img')!==null});

    email.value='hello@example.org';
    email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    const valid=new Event('submit',{bubbles:true,cancelable:true});
    form.dispatchEvent(valid);
    trace.push({...capture('valid'),cancelled:valid.defaultPrevented});
    const variations=[
      ['required-empty',''],
      ['missing-at','not-an-email'],
      ['missing-domain','person@'],
      ['plus-address','person+tag@example.org'],
      ['hyphen-host','a-b@example.co.uk'],
      ['embedded-space','hello world@example.org']
    ];
    for(const [stage,value] of variations){
      email.value=value;
      email.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
      const attempt=new Event('submit',{bubbles:true,cancelable:true});
      form.dispatchEvent(attempt);
      trace.push({...capture(stage),cancelled:attempt.defaultPrevented});
    }
  }catch(e){trace.push({error:String(e)});}
  const result=document.createElement('output');
  result.id='browser-parity-trace';
  result.textContent=encodeURIComponent(JSON.stringify(trace));
  document.body.append(result);
},{once:true});
