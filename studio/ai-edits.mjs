import { createHash } from 'node:crypto';

export const FORMAT='hcode.edits.v1';
export const digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
export class ProposalError extends Error { constructor(message,status=422){super(message);this.name='ProposalError';this.status=status;} }
const fail=(message,status)=>{throw new ProposalError(message,status)};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const byteLength=x=>Buffer.byteLength(x,'utf8');

// This is intentionally a strict, model-neutral protocol. No fuzzy matching, eval,
// shell interpretation, AI-provider calls or implicit acceptance of model output.
export function prepareProposal(proposal,read){
 if(!record(proposal)||proposal.format!==FORMAT)fail('Expected format hcode.edits.v1');
 if(typeof proposal.summary!=='string'||proposal.summary.trim().length<3||proposal.summary.length>300)fail('Summary must have 3-300 characters');
 if(!Array.isArray(proposal.files)||proposal.files.length===0||proposal.files.length>8)fail('Expected 1-8 edited files');
 const paths=new Set();const result=[];let totalEdits=0;
 for(const file of proposal.files){
  if(!record(file)||typeof file.path!=='string'||file.path.length>180||!sha(file.revision))fail('File requires path and SHA-256 revision');
  if(paths.has(file.path))fail('Duplicate file in proposal: '+file.path);paths.add(file.path);
  if(!Array.isArray(file.edits)||!file.edits.length||file.edits.length>24)fail('Each file needs 1-24 exact edits');
  totalEdits+=file.edits.length;if(totalEdits>48)fail('Too many edits');
  const before=read(file.path);
  if(typeof before!=='string')fail('Cannot read file '+file.path);
  if(digest(before)!==file.revision)fail('File changed after AI context was prepared: '+file.path,409);
  let after=before;const changes=[];
  for(const edit of file.edits){
   if(!record(edit)||typeof edit.oldText!=='string'||typeof edit.newText!=='string')fail('Each edit needs oldText and newText');
   if(!edit.oldText||edit.oldText===edit.newText||byteLength(edit.oldText)>16384||byteLength(edit.newText)>16384)fail('Edit must replace a nonempty, changed snippet under 16 KiB');
   if(edit.oldText.includes('\u0000')||edit.newText.includes('\u0000'))fail('NUL characters are not permitted');
   const first=after.indexOf(edit.oldText);
   if(first<0)fail('Exact snippet missing in '+file.path);
   if(after.indexOf(edit.oldText,first+1)!==-1)fail('Snippet occurs more than once in '+file.path+'; include more context');
   const line=1+after.slice(0,first).split('\n').length-1;
   after=after.slice(0,first)+edit.newText+after.slice(first+edit.oldText.length);
   changes.push({line,oldText:edit.oldText,newText:edit.newText});
  }
  if(byteLength(after)>131072)fail('Result exceeds 128 KiB: '+file.path);
  result.push({path:file.path,before,after,revision:file.revision,newRevision:digest(after),changes});
 }
 return {summary:proposal.summary.trim(),files:result};
}

// Previews are server-held. The client receives an opaque approval ID rather
// than carrying altered source in the apply request.
export function applyPrepared(prepared,{read,write,check}){
 if(!record(prepared)||!Array.isArray(prepared.files)||!prepared.files.length)fail('Missing approved preview');
 // Check every revision BEFORE touching any file.
 for(const file of prepared.files){if(digest(read(file.path))!==file.revision)fail('Stale preview: '+file.path,409);}
 const changed=[];
 try{
  for(const file of prepared.files){write(file.path,file.after);changed.push(file);}
  for(const file of prepared.files){check?.(file.path);}
 }catch(error){
  const failures=[];
  for(const file of changed.reverse()){try{write(file.path,file.before);}catch(e){failures.push(file.path+': '+e.message);}}
  if(failures.length)fail('Apply failed; rollback incomplete: '+failures.join('; '),500);
  fail('Apply rejected; original files restored: '+error.message,422);
 }
 return {ok:true,files:prepared.files.map(f=>({path:f.path,revision:f.newRevision})),message:'Approved changes saved and typechecked'};
}