// M16 v2 package-source validation over the *existing* H-Code reference AST.
// This checks declarations AND bodies, including private helper functions, before
// package code can execute. No eval, JS callback, host globals, dynamic imports or AI.
const scalar=new Set(['Number','String','Bool','Unit']);
const error=message=>{throw Error('Invalid H-Code package v2: '+message)};
const isSeq=t=>typeof t==='string'&&t.startsWith('⟦')&&t.endsWith('⟧');
const element=t=>t.slice(1,-1);
const sequence=t=>'⟦'+t+'⟧';
const callable=(params,result)=>({kind:'function',params,result});
const isFn=t=>t&&typeof t==='object'&&t.kind==='function';
const typeName=t=>isFn(t)?'('+t.params.map(typeName).join(',')+')→'+typeName(t.result):t;

export function contractType(name,format=2,depth=0,binders=[]){
  if(typeof name!=='string'||name.length>256||depth>16)error('Contract type too deep or long');
  if(scalar.has(name))return name;
  if(format===3&&binders.includes(name))return name;
  if(format>=2&&isSeq(name)){
    contractType(element(name),format,depth+1,binders);
    return name;
  }
  error('Unsupported or unbound contract type '+name);
}
function merge(a,b,why){
  if(a==='?')return b;
  if(b==='?')return a;
  if(isFn(a)&&isFn(b)&&a.params.length===b.params.length)
    return callable(a.params.map((t,i)=>merge(t,b.params[i],why)),merge(a.result,b.result,why));
  if(isSeq(a)&&isSeq(b))return sequence(merge(element(a),element(b),why));
  if(a===b)return a;
  error(why+': expected '+typeName(a)+', got '+typeName(b));
}
function known(t){
  if(t==='?'||isSeq(t)&&!known(element(t)))return false;
  if(isFn(t))return t.params.every(known)&&known(t.result);
  return true;
}
function requireType(actual,expected,why){
  const result=merge(expected,actual,why);
  if(expected!==null&&!known(result))error(why+': type not fully inferred');
  return result;
}
function infer(node,env,expected=null){
  if(!node||typeof node.kind!=='string')error('Malformed expression');
  let out;
  switch(node.kind){
    case 'Literal':
      out=typeof node.value==='number'?'Number':typeof node.value==='string'?'String':
        typeof node.value==='boolean'?'Bool':null;
      if(!out)error('Unsupported literal');break;
    case 'Identifier':
      if(!env.has(node.name))error('Unknown or effectful identifier '+node.name);
      out=env.get(node.name);break;
    case 'Sequence':{
      let inner=isSeq(expected)?element(expected):'?';
      for(const v of node.items){
        const t=infer(v,env,inner==='?'?null:inner);
        inner=merge(inner,t,'Sequence elements must have matching types');
      }
      out=sequence(inner);break;
    }
    case 'Index':{
      const seq=infer(node.sequence,env);
      if(!isSeq(seq))error('Sequence index requires a sequence');
      requireType(infer(node.index,env),'Number','Index must be Number');
      out=element(seq);break;
    }
    case 'Length':{
      const seq=infer(node.value,env);
      if(!isSeq(seq))error('⌗ requires a typed sequence');out='Number';break;
    }
    case 'Sum':
      requireType(infer(node.value,env,sequence('Number')),sequence('Number'),'∑ requires numeric sequence');
      out='Number';break;
    case 'Unary':
      requireType(infer(node.value,env),node.operator==='-'?'Number':'Bool','Invalid unary operator');
      out=node.operator==='-'?'Number':'Bool';break;
    case 'Lambda':{
      const paramType=isFn(expected)?expected.params[0]:null;
      if(!paramType||expected.params.length!==1)error('λ requires an inferable unary parameter type');
      const nested=new Map(env);nested.set(node.parameter,paramType);
      const result=infer(node.body,nested,expected?.result??null);
      out=callable([paramType],result);break;
    }
    case 'Section':{
      const rhs=infer(node.right,env);
      const op=node.operator;
      if(['*','/','%','<','>','<=','>='].includes(op)){
        requireType(rhs,'Number','Operator section requires Number');
        out=callable(['Number'],['<','>','<=','>='].includes(op)?'Bool':'Number');
      }else if(op==='+'&&['Number','String'].includes(rhs)){
        out=callable([rhs],rhs);
      }else if(['==','!='].includes(op)&&scalar.has(rhs)&&rhs!=='Unit'){
        out=callable([rhs],'Bool');
      }else error('Unsupported or untyped operator section');
      break;
    }
    case 'Choice':{
      requireType(infer(node.condition,env),'Bool','Choice condition must be Bool');
      const a=infer(node.whenTrue,env,expected),b=infer(node.whenFalse,env,expected);
      out=merge(a,b,'Choice branches must have matching types');break;
    }
    case 'Binary':{
      const op=node.operator;
      if(op==='@?'||op==='@>'){
        const xs=infer(node.left,env);
        if(!isSeq(xs))error('⌕/⇢ left side must be typed sequence');
        const input=element(xs);
        if(input==='?')error('⌕/⇢ cannot infer empty sequence without type');
        const target=op==='@?'?callable([input],'Bool'):isSeq(expected)?callable([input],element(expected)):callable([input],'?');
        const fn=infer(node.right,env,target);
        if(!isFn(fn)||fn.params.length!==1)error('⌕/⇢ requires a unary H-Code function');
        requireType(fn.params[0],input,'⌕/⇢ callback input');
        if(op==='@?')requireType(fn.result,'Bool','⌕ callback must return Bool');
        out=op==='@?'?xs:sequence(fn.result);
      }else if(op==='++'){
        const a=infer(node.left,env,expected),b=infer(node.right,env,expected??a);
        if(!isSeq(a)||!isSeq(b))error('⧺ requires typed sequences');
        out=merge(a,b,'⧺ sequence element mismatch');
      }else if(op==='<<'){
        const a=infer(node.left,env),b=infer(node.right,env);
        if(!isFn(a)||!isFn(b)||a.params.length!==1||b.params.length!==1)error('∘ requires unary functions');
        requireType(b.result,a.params[0],'Composition inner/outer types');
        out=callable(b.params,a.result);
      }else{
        const a=infer(node.left,env),b=infer(node.right,env);
        if(op==='+'){
          if(!['Number','String'].includes(a))error('+ requires Number or String');
          requireType(b,a,'+ operands');
          out=a;
        }else if(['-','*','/','%','<','>','<=','>='].includes(op)){
          requireType(a,'Number','Numeric left operand');
          requireType(b,'Number','Numeric right operand');
          out=['<','>','<=','>='].includes(op)?'Bool':'Number';
        }else if(['==','!='].includes(op)){
          if(!scalar.has(a))error('Equality requires primitive type');
          requireType(b,a,'Equality operands');
          out='Bool';
        }else if(['and','or'].includes(op)){
          requireType(a,'Bool','Boolean operand');
          requireType(b,'Bool','Boolean operand');out='Bool';
        }else error('Unsupported pure binary operator '+op);
      }
      break;
    }
    case 'Call':{
      const fn=infer(node.callee,env);
      if(!isFn(fn)||fn.params.length!==node.args.length)error('Wrong function arity or non-callable');
      for(let i=0;i<node.args.length;i++)
        requireType(infer(node.args[i],env,fn.params[i]),fn.params[i],'Call argument '+(i+1));
      out=fn.result;break;
    }
    default:error('Unsupported or effectful expression '+node.kind);
  }
  if(expected)out=merge(expected,out,'Expected expression type');
  return out;
}
function validateBlock(block,env,ret,functions,format=2,binders=[]){
  if(!block||block.kind!=='Block'||!Array.isArray(block.body))error('Invalid H-Code block');
  const current=new Map(env);
  let returned=false;
  for(const stmt of block.body){
    if(returned)error('Unreachable package statement after unconditional return');
    switch(stmt.kind){
      case 'Let':{
        if(current.has(stmt.name)||functions.has(stmt.name))error('Duplicate or shadowed local '+stmt.name);
        const annotation=stmt.annotation?contractType(stmt.annotation,format,0,binders):null;
        const actual=infer(stmt.value,current,annotation);
        const t=annotation?merge(annotation,actual,'Local declaration'):actual;
        if(!known(t))error('Unresolved local type '+stmt.name);
        current.set(stmt.name,t);break;
      }
      case 'Assign':{
        if(!current.has(stmt.name)||functions.has(stmt.name))error('Assignment to unknown/immutable name '+stmt.name);
        const actual=infer(stmt.value,current,current.get(stmt.name));
        requireType(actual,current.get(stmt.name),'Assignment type mismatch');break;
      }
      case 'Return':{
        const got=infer(stmt.value,current,ret);
        requireType(got,ret,'Return type mismatch');
        returned=true;break;
      }
      case 'If':{
        requireType(infer(stmt.condition,current),'Bool','if condition must be Bool');
        const yes=validateBlock(stmt.then,current,ret,functions,format,binders);
        const no=stmt.otherwise?validateBlock(stmt.otherwise,current,ret,functions,format,binders):false;
        returned=yes&&no;break;
      }
      case 'While':{
        requireType(infer(stmt.condition,current),'Bool','while condition must be Bool');
        validateBlock(stmt.body,current,ret,functions,format,binders);break;
      }
      case 'ExpressionStatement':
        infer(stmt.value,current);break;
      default:error('Unsafe or unsupported package statement '+stmt.kind);
    }
  }
  return returned;
}
function validatePurePackage(ast,manifest,format){
  if(!ast||ast.kind!=='Program'||!Array.isArray(ast.body)||ast.body.length===0||ast.body.length>128)
    error('Package source requires 1..128 pure functions');
  const defs=new Map(),functions=new Map();
  for(const stmt of ast.body){
    if(stmt.kind!=='Function')error('Only top-level pure functions are permitted');
    if(defs.has(stmt.name)||stmt.name==='print')error('Duplicate or reserved function '+stmt.name);
    if(typeof stmt.returnType!=='string'||!Array.isArray(stmt.params)||stmt.params.length>32)
      error('Every package function needs explicit return and parameter types');
    const binders=stmt.typeParameters??[];
    if(format===2&&binders.length)error('∀ requires format 3');
    if(binders.length>8||new Set(binders).size!==binders.length)error('Duplicate or excessive ∀ binder');
    for(const name of binders){
      if(!/^[A-Z][A-Za-z0-9_]*$/.test(name)||name.length>32||scalar.has(name))
        error('Invalid ∀ binder '+name);
    }
    const params=[];
    for(const param of stmt.params){
      if(typeof param.type!=='string'||params.some(x=>x.name===param.name))
        error('Every parameter needs a distinct explicit type');
      params.push({name:param.name,type:contractType(param.type,format,0,binders)});
    }
    const result=contractType(stmt.returnType,format,0,binders);
    defs.set(stmt.name,{stmt,params,result,binders});
    functions.set(stmt.name,callable(params.map(x=>x.type),result));
  }
  for(const op of manifest.operations){
    const declaration=defs.get(op.implementation);
    if(!declaration)error('Missing exported H-Code implementation '+op.implementation);
    if(declaration.params.length!==op.parameters.length)error('Manifest/source arity mismatch');
    if(JSON.stringify(declaration.binders)!==JSON.stringify(op.typeParameters??[]))
      error('Manifest/source ∀ binder mismatch');
    for(let i=0;i<declaration.params.length;i++){
      const param=declaration.params[i],declared=op.parameters[i];
      if(param.name!==declared.name||param.type!==declared.type)
        error('Manifest/source parameter mismatch in '+op.implementation);
    }
    if(declaration.result!==op.returns)error('Manifest/source return type mismatch in '+op.implementation);
  }
  for(const [name,declaration] of defs){
    const env=new Map(functions);
    for(const param of declaration.params){
      if(env.has(param.name))error('Parameter shadows library function '+param.name);
      env.set(param.name,param.type);
    }
    const hasReturn=validateBlock(declaration.stmt.body,env,declaration.result,functions,format,declaration.binders);
    if(!hasReturn&&declaration.result!=='Unit')
      error('Pure function '+name+' does not return on every path');
  }
  return true;
}

export function validatePurePackageV2(ast,manifest){return validatePurePackage(ast,manifest,2);}
export function validatePurePackageV3(ast,manifest){return validatePurePackage(ast,manifest,3);}
