const token=document.querySelector('meta[name="studio-token"]').content;let current=null,revision=null,saved='';const el=id=>document.getElementById(id);const source=el('source');const buttons=['save','check','build','run'];const symbols=[['ƒ','fn'],['≔','let'],['↩','return'],['→','->'],['←','='],['⊤','true'],['⊥','false'],['∧','and'],['∨','or'],['¬','not'],['≡','=='],['≠','!='],['≤','<='],['≥','>='],['∷','::'],['▷','|>'],['∘','<<'],['◇','?'],['⟦','[['],['⟧',']]'],['⦃','{'],['⦄','}'],['·','.'],['⊞','<+'],['⌗','#'],['⧺','++'],['∑','@+'],['⌕','@?'],['⇢','@>'],['λ','lambda'],['⊢','if'],['⊣','else'],['⟳','while'],['⇒','=>']];const glyphs=el('symbols');for(const [glyph,label] of symbols){const b=document.createElement('button');b.className='symbol';b.title='H-Code '+glyph+' = '+label;b.setAttribute('aria-label','Insert H-Code symbol '+glyph+' ('+label+')');const big=document.createElement('b');big.textContent=glyph;const caption=document.createElement('span');caption.textContent=label;b.append(big,caption);b.addEventListener('click',()=>{if(source.disabled)return;const start=source.selectionStart;source.setRangeText(glyph,start,source.selectionEnd,'end');source.focus();clearApproval();changed();});glyphs.append(b)}function lines(){el('lines').textContent=Array.from({length:Math.max(1,source.value.split('\n').length)},(_,i)=>i+1).join('\n')}function changed(){lines();el('dirty').classList.toggle('on',source.value!==saved);el('state').textContent=source.value===saved?'SAVED':'UNSAVED';const before=source.value.slice(0,source.selectionStart).split('\n');el('cursor').textContent='Ln '+before.length+', Col '+(before.at(-1).length+1)}source.addEventListener('input',changed);source.addEventListener('click',changed);source.addEventListener('keyup',changed);source.addEventListener('scroll',()=>{el('lines').scrollTop=source.scrollTop});async function api(route,body){const url='/api/'+route+(body===undefined?(route.includes('?')?'&':'?')+'token='+encodeURIComponent(token):'');const result=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','x-studio-token':token},body:JSON.stringify(body)});const data=await result.json();if(!result.ok)throw Error(data.error||'Request failed');return data}function log(t){el('output').textContent=t}function enable(on){for(const id of buttons)el(id).disabled=!on}async function openFile(path){if(current&&source.value!==saved&&!confirm('Discard unsaved changes?'))return;const f=await api('file?path='+encodeURIComponent(path));current=f.path;revision=f.revision;saved=f.content;source.value=saved;source.disabled=false;el('filename').textContent=path.split('/').at(-1);el('path').textContent=path;for(const b of document.querySelectorAll('.file'))b.classList.toggle('active',b.dataset.path===path);enable(true);changed();log('Loaded '+path+'\nReady to check, build or run.')}async function load(){const d=await api('files');const nav=el('files');let previous='';for(const path of d.files){const folder=path.split('/').slice(0,-1).join('/');if(folder!==previous){const title=document.createElement('div');title.className='tree-folder';title.textContent=folder;nav.append(title);previous=folder}const b=document.createElement('button');b.className='file';b.textContent=path.split('/').at(-1);b.dataset.path=path;b.title=path;b.addEventListener('click',()=>openFile(path).catch(e=>log(e.message)));nav.append(b)}if(d.files.length)await openFile(d.files.includes('m5/invoice/main.hc')?'m5/invoice/main.hc':d.files[0])}async function save(){if(!current)return;const d=await api('save',{path:current,content:source.value,revision});revision=d.revision;saved=source.value;changed();log('Saved '+current)}async function task(command){if(!current)return;try{if(source.value!==saved)await save();enable(false);el('state').textContent=command.toUpperCase()+'...';log('> hcodec '+command+' '+current+'\n\nCompiling...');const d=await api('task',{command,path:current});log('> hcodec '+command+' '+current+'\n\n'+(d.stdout||'')+(d.stderr||'')+'\n'+(d.ok?'Completed successfully.':'Command failed (exit '+d.exit+').'));el('state').textContent=d.ok?'SUCCESS':'ERROR'}catch(e){log('ERROR: '+e.message);el('state').textContent='ERROR'}finally{enable(true)}}el('save').addEventListener('click',()=>save().catch(e=>log(e.message)));for(const c of ['check','build','run'])el(c).addEventListener('click',()=>task(c));el('clear').addEventListener('click',()=>log('Output cleared.'));document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save().catch(x=>log(x.message))}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();task('run')}if(e.key==='Tab'&&document.activeElement===source){e.preventDefault();source.setRangeText('  ',source.selectionStart,source.selectionEnd,'end');changed()}});load().catch(e=>log('Could not load files: '+e.message));

let approval=null;
function reviewMessage(text){el('ai-review').textContent=text}
function clearApproval(){approval=null;el('ai-apply').disabled=true}
source.addEventListener('input',clearApproval);
el('ai-proposal').addEventListener('input',clearApproval);
el('ai-context').addEventListener('click',async()=>{
 try{
  if(!current)throw Error('Select a H-Code file first');
  const context={format:'hcode.edits.v1',task:'Propose exact, minimal edits to this H-Code file; return JSON only. Do not execute code.',path:current,revision,source:source.value,proposalShape:{format:'hcode.edits.v1',summary:'Short explanation',files:[{path:current,revision,edits:[{oldText:'exact unique snippet',newText:'replacement'}]}]}};
  await navigator.clipboard.writeText(JSON.stringify(context,null,2));reviewMessage('Context copied. Paste an AI-produced hcode.edits.v1 proposal below.');
 }catch(e){reviewMessage(e.message)}
});
el('ai-template').addEventListener('click',()=>{
 if(!current)return reviewMessage('Choose a file first.');
 el('ai-proposal').value=JSON.stringify({format:'hcode.edits.v1',summary:'Describe your code changes',files:[{path:current,revision,edits:[{oldText:'exact existing code',newText:'updated code'}]}]},null,2);
 clearApproval();reviewMessage('Edit the example JSON and select Preview.');
});
el('ai-preview').addEventListener('click',async()=>{
 clearApproval();
 try{
  if(source.value!==saved)throw Error('Save the current file before previewing external edits.');
  const proposal=JSON.parse(el('ai-proposal').value);
  const d=await api('ai/preview',{proposal});
  approval=d.id;
  const blocks=[];
  for(const file of d.files){blocks.push(file.path);for(const change of file.changes){blocks.push('Line '+change.line+'\n- '+change.oldText+'\n+ '+change.newText);}}
  reviewMessage(d.summary+'\n\n'+blocks.join('\n\n'));
  el('ai-apply').disabled=false;
 }catch(e){reviewMessage('Preview rejected: '+e.message);}
});
el('ai-apply').addEventListener('click',async()=>{
 if(!approval)return;
 const id=approval;clearApproval();
 try{
  if(!confirm('Apply the reviewed changes to the selected files?'))return;
  const result=await api('ai/apply',{id});
  reviewMessage(result.message+'\n'+result.files.map(x=>x.path).join('\n'));
  if(current&&result.files.some(x=>x.path===current)){source.value=saved;await openFile(current);}
 }catch(e){reviewMessage('Apply rejected: '+e.message);}
});

function displayAIReview(d){approval=d.id;const blocks=[];for(const file of d.files){blocks.push(file.path);for(const change of file.changes)blocks.push('Line '+change.line+'\n- '+change.oldText+'\n+ '+change.newText);}reviewMessage(d.summary+'\n\n'+blocks.join('\n\n'));el('ai-apply').disabled=false}
el('api-connect').addEventListener('click',async()=>{const key=el('api-key');const button=el('api-connect');button.disabled=true;el('api-status').textContent='Testing OpenAI access...';try{const d=await api('ai/connect',{apiKey:key.value,model:el('api-model').value});key.value='';el('api-status').textContent='Connected to '+d.model;el('api-setup').hidden=true;reviewMessage('OpenAI ready: '+d.model+'. Ask for a precise H-Code change.');}catch(e){key.value='';el('api-status').textContent='Connection failed: '+e.message;}finally{button.disabled=false}});
el('api-skip').addEventListener('click',()=>{el('api-key').value='';el('api-setup').hidden=true;});
el('ai-disconnect').addEventListener('click',async()=>{try{await api('ai/disconnect',{});clearApproval();reviewMessage('AI disconnected. Refresh to reconnect.');}catch(e){reviewMessage(e.message)}});
el('ai-generate').addEventListener('click',async()=>{clearApproval();const button=el('ai-generate');button.disabled=true;try{if(!current)throw Error('Select a file');if(source.value!==saved)throw Error('Save your changes first');reviewMessage('Waiting for AI proposal...');const d=await api('ai/generate',{path:current,revision,instruction:el('ai-instruction').value});el('ai-proposal').value=JSON.stringify(d.proposal,null,2);displayAIReview(d);}catch(e){reviewMessage('AI request rejected: '+e.message)}finally{button.disabled=false}});
api('ai/status').then(s=>{if(s.connected){el('api-setup').hidden=true;reviewMessage('AI connected: '+s.model)}}).catch(()=>{});
