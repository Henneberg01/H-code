// Chromium-only accessibility/HTML-injection/SQLite output probe.
document.addEventListener('DOMContentLoaded',()=>{
  try{
    const table=document.querySelector('#results');
    const columns=[...table.querySelectorAll('thead th')].map(el=>({
      text:el.textContent,tag:el.tagName,scope:el.getAttribute('scope')
    }));
    const cells=[...table.querySelectorAll('tbody tr')].map(tr=>
      [...tr.children].map(cell=>({text:cell.textContent,tag:cell.tagName,scope:cell.getAttribute('scope')})));
    const marker={
      summary:document.querySelector('#summary').textContent,
      empty:document.querySelector('#empty').textContent,
      caption:table.querySelector('caption')?.textContent??null,
      columns,cells,
      scripts:document.querySelectorAll('main section script').length,
      images:document.querySelectorAll('main section img').length,
      from:document.querySelector('input[name=from]').value,
      to:document.querySelector('input[name=to]').value
    };
    document.querySelector('#hcode-db-proof').textContent=encodeURIComponent(JSON.stringify(marker));
  }catch(error){
    document.querySelector('#hcode-db-proof').textContent=encodeURIComponent(JSON.stringify({
      fatal:String(error?.stack||error)
    }));
  }
});
