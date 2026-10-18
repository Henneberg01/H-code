// M16.2: first-class ∀ contracts; freshly specialize every call, never Any.
// The authoring source has already been parsed, SHA-locked and body-typechecked.
const fail=(message)=>{throw Error('H-Code generic type error: '+message);};
const SCALARS=new Set(['Number','String','Bool','Unit']);
const VARIABLE=/^[A-Z][A-Za-z0-9_]*$/;
const scalar=name=>({kind:'scalar',name});
const generic=name=>({kind:'generic',name});
const sequence=element=>({kind:'sequence',element});
const unknown=()=>({kind:'unknown'});
const format=type=>type.kind==='scalar'||type.kind==='generic'?type.name:
  type.kind==='sequence'?'⟦'+format(type.element)+'⟧':'?';

export function normalizeBinders(names){
  if(!Array.isArray(names)||names.length>8||new Set(names).size!==names.length)
    fail('Duplicate or excessive ∀ binders');
  for(const v of names){
    if(typeof v!=='string'||!VARIABLE.test(v)||v.length>32||SCALARS.has(v))
      fail('Invalid ∀ binder '+String(v));
  }
  return names;
}
export function parseParamType(source,binders,depth=0){
  if(typeof source!=='string'||source.length>256||depth>16)
    fail('Excessive or invalid type signature');
  if(SCALARS.has(source))return scalar(source);
  if(binders.includes(source))return generic(source);
  if(source.startsWith('⟦')&&source.endsWith('⟧'))
    return sequence(parseParamType(source.slice(1,-1),binders,depth+1));
  fail('Unsupported or unbound type '+source);
}
function observedType(value,depth=0,maxSequenceItems=16384){
  if(depth>16)fail('Runtime nesting limit exceeded');
  if(value===null)return scalar('Unit');
  if(typeof value==='number'&&Number.isFinite(value))return scalar('Number');
  if(typeof value==='string')return scalar('String');
  if(typeof value==='boolean')return scalar('Bool');
  if(Array.isArray(value)){
    if(value.length>maxSequenceItems)fail('Sequence allocation limit exceeded');
    let elem=unknown();
    for(const item of value)elem=merge(elem,observedType(item,depth+1,maxSequenceItems));
    return sequence(elem);
  }
  fail('Invalid H-Code runtime value');
}
function merge(a,b){
  if(a.kind==='unknown')return b;
  if(b.kind==='unknown')return a;
  if(a.kind!==b.kind||a.kind==='scalar'&&a.name!==b.name)
    fail('Heterogeneous sequence: '+format(a)+' vs '+format(b));
  if(a.kind==='sequence')return sequence(merge(a.element,b.element));
  return a;
}
function match(expect,got,binding,at){
  if(got.kind==='unknown')return;
  if(expect.kind==='generic'){
    const earlier=binding.get(expect.name);
    if(earlier)binding.set(expect.name,merge(earlier,got));
    else binding.set(expect.name,got);
    return;
  }
  if(expect.kind!==got.kind||expect.kind==='scalar'&&expect.name!==got.name)
    fail(at+' expected '+format(expect)+', got '+format(got));
  if(expect.kind==='sequence')match(expect.element,got.element,binding,at+'[]');
}
const hasUnknown=t=>t.kind==='unknown'||t.kind==='sequence'&&hasUnknown(t.element);
function specialize(type,binding){
  if(type.kind==='generic'){
    const value=binding.get(type.name);
    if(!value)fail('Unbound generic result '+type.name);
    return value;
  }
  if(type.kind==='sequence')return sequence(specialize(type.element,binding));
  return type;
}
export function verifyGenericManifestOperation(op){
  const binders=normalizeBinders(op.typeParameters??[]);
  if(!Array.isArray(op.parameters)||op.parameters.length>32)fail('Invalid operation arity');
  const params=op.parameters.map(x=>parseParamType(x.type,binders));
  const returned=parseParamType(op.returns,binders);
  for(const name of binders){
    const mentions=t=>t.kind==='generic'&&t.name===name||
      t.kind==='sequence'&&mentions(t.element);
    if(!params.some(mentions))fail('Cannot infer ∀ binder '+name+' from arguments');
    if(!params.some(mentions)&&!mentions(returned))fail('Unused ∀ binder '+name);
  }
  return true;
}
export function specializeCall(op,args,maxSequenceItems=16384){
  if(!Array.isArray(args)||args.length!==op.parameters.length)
    fail((op.name??'operation')+' expects '+op.parameters.length+' argument(s)');
  const binders=normalizeBinders(op.typeParameters??[]);
  const binding=new Map();
  for(let i=0;i<args.length;i++){
    const expected=parseParamType(op.parameters[i].type,binders);
    const got=observedType(args[i],0,maxSequenceItems);
    match(expected,got,binding,'Argument '+(i+1));
  }
  for(const name of binders){
    const bound=binding.get(name);
    if(!bound||hasUnknown(bound))fail('Cannot infer ∀'+name+' from the call (empty/untyped sequence)');
  }
  return {
    parameterTypes:op.parameters.map(p=>specialize(parseParamType(p.type,binders),binding)),
    returnType:specialize(parseParamType(op.returns,binders),binding),
    bindings:binding
  };
}
export function checkSpecializedReturn(result,specialized,maxSequenceItems=16384){
  const actual=observedType(result,0,maxSequenceItems);
  match(specialized.returnType,actual,new Map(),'Return');
  return result;
}
export function typeToString(type){return format(type);}
