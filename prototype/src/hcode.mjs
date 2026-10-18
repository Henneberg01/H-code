// H-Code M1 reference interpreter and symbol linker. NOT a production compiler.
export const CORE_GLYPHS = Object.freeze({
  '\u0192': 'fn', '\u2254': 'let', '\u21a9': 'return', '\u2192': '->',
  '\u2190': '=', '\u22a4': 'true', '\u22a5': 'false',
  '\u2227': 'and', '\u2228': 'or', '\u00ac': 'not',
  '\u2261': '==', '\u2260': '!=', '\u2264': '<=', '\u2265': '>=',
  '\u22a2': 'if', '\u22a3': 'else', '\u27f3': 'while', '\u21d2': '=>',
  '\u2237': '::', '\u25b7': '|>', '\u2218': '<<', '\u25c7': '?', '\u27e6': '[[', '\u27e7': ']]', '\u2317': '#', '\u29fa': '++', '\u2211': '@+', '\u2315': '@?', '\u21e2': '@>', '\u03bb': 'lambda'
});
export const RESERVED_USER_GLYPHS = new Set(['\u2205', '\u2200', '\u2208', ...Object.keys(CORE_GLYPHS)]);
const RESERVED = new Set(['fn','let','return','true','false','if','else','while','and','or','not','use','as','lambda']);
const TWO = new Set(['==','!=','<=','>=','->','::','|>','<<','[[',']]','++','@+','@?','@>','=>']);
const ONE = new Set(['+','-','*','/','%','<','>','=','(',')','{','}',',',';',':','?','#']);
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]|\p{Default_Ignorable_Code_Point}/u;
const SYMBOL_CHARACTER = /^\p{S}$/u;

export class HCodeError extends Error {
  constructor(message, line=1, column=1) {
    super(`${message} at ${line}:${column}`);
    this.name = 'HCodeError'; this.line = line; this.column = column;
  }
}

export function tokenize(source) {
  if (typeof source !== 'string') throw new TypeError('source must be a string');
  const s = source.normalize('NFC');
  const bad = ILLEGAL.exec(s);
  if (bad) {
    const before = s.slice(0,bad.index).split('\n');
    throw new HCodeError('Forbidden control/invisible/directional character', before.length, [...before.at(-1)].length+1);
  }
  const tokens=[];
  let i=0,line=1,column=1;
  function peek(n=0) {
    let j=i;
    while(n-- > 0 && j<s.length) j += String.fromCodePoint(s.codePointAt(j)).length;
    return j<s.length ? String.fromCodePoint(s.codePointAt(j)) : undefined;
  }
  function advance() {
    const c=peek(); i+=c.length;
    if(c==='\n'){line++;column=1;} else column++;
    return c;
  }
  function emit(type,value,startLine,startColumn){tokens.push({type,value,line:startLine,column:startColumn});}
  const digit=c=>c!==undefined && c>='0' && c<='9';
  const letter=c=>c!==undefined && /^[A-Za-z_]$/.test(c);
  const alnum=c=>letter(c)||digit(c);
  while(i<s.length){
    const c=peek(),ln=line,col=column;
    if(/\s/u.test(c)){advance();continue;}
    if(c==='/'&&peek(1)==='/'){while(i<s.length&&peek()!=='\n')advance();continue;}
    if(c==='/'&&peek(1)==='*'){
      advance();advance();let closed=false;
      while(i<s.length){if(peek()==='*'&&peek(1)==='/'){advance();advance();closed=true;break;}advance();}
      if(!closed)throw new HCodeError('Unterminated block comment',ln,col);
      continue;
    }
    if(c==='"'){
      advance();let value='',closed=false;
      while(i<s.length){
        const d=advance();
        if(d==='"'){closed=true;break;}
        if(d==='\n')throw new HCodeError('Newline in string',ln,col);
        if(d==='\\'){
          if(i>=s.length)break;
          const e=advance(),escapes={n:'\n',t:'\t',r:'\r','"':'"','\\':'\\'};
          if(!Object.hasOwn(escapes,e))throw new HCodeError('Unsupported string escape',line,column-1);
          value+=escapes[e];
        } else value+=d;
      }
      if(!closed)throw new HCodeError('Unterminated string',ln,col);
      emit('string',value,ln,col);continue;
    }
    if(digit(c)){
      let raw='';while(digit(peek()))raw+=advance();
      if(peek()==='.'&&digit(peek(1))){raw+=advance();while(digit(peek()))raw+=advance();}
      emit('number',Number(raw),ln,col);continue;
    }
    if(letter(c)){
      let word='';while(alnum(peek()))word+=advance();
      emit(RESERVED.has(word)?word:'ident',word,ln,col);continue;
    }
    if(Object.hasOwn(CORE_GLYPHS,c)){
      advance();const alias=CORE_GLYPHS[c];emit(alias,alias,ln,col);continue;
    }
    const two=c+(peek(1)??'');
    if(TWO.has(two)){advance();advance();emit(two,two,ln,col);continue;}
    if(ONE.has(c)){advance();emit(c,c,ln,col);continue;}
    // Reject a split ASCII pipe instead of interpreting it as a package glyph.
    if(c==='|')throw new HCodeError('Unexpected character "|"; use ▷ or |>',ln,col);
    if(SYMBOL_CHARACTER.test(c)){
      advance();emit('glyph',c,ln,col);continue;
    }
    throw new HCodeError(`Unexpected character ${JSON.stringify(c)}`,ln,col);
  }
  emit('eof','',line,column);
  return tokens;
}

class Parser {
  constructor(tokens){this.t=tokens;this.i=0;}
  peek(n=0){return this.t[this.i+n]??this.t[this.t.length-1];}
  at(kind){return this.peek().type===kind;}
  accept(kind){if(this.at(kind))return this.t[this.i++];return null;}
  expect(kind){const got=this.accept(kind);if(got)return got;const t=this.peek();throw new HCodeError(`Expected ${kind}; got ${t.type}`,t.line,t.column);}
  program(){const body=[];while(!this.at('eof'))body.push(this.stmt(true));return {kind:'Program',body};}
  block(){this.expect('{');const body=[];while(!this.at('}')){if(this.at('eof'))this.expect('}');body.push(this.stmt(false));}this.expect('}');return {kind:'Block',body};}
  // M15: no separator needed at EOF, }, newline or a distinct statement keyword.
  // An infix operator on the following line continues the existing expression.
  statementEnd(){
    if(this.accept(';'))return;
    const next=this.peek(),previous=this.t[this.i-1];
    const certain=new Set(['fn','let','return','if','while','use','import','export','else']);
    if(['}','eof'].includes(next.type)||certain.has(next.type)||
       (previous&&next.line>previous.line))return;
    throw new HCodeError('Expected ; or an unambiguous statement boundary',next.line,next.column);
  }
  // The ⇒ sign produces exactly one ordinary Block AST statement.
  controlBody(){
    if(this.accept('=>'))return {kind:'Block',body:[this.stmt(false)]};
    return this.block();
  }
  typeName(){
    if(this.accept('[[')){
      const element=this.typeName();
      this.expect(']]');
      return '⟦'+element+'⟧';
    }
    return this.expect('ident').value;
  }
  stmt(topLevel=false){
    if(this.at('use')){
      const t=this.expect('use');
      if(!topLevel)throw new HCodeError('Package imports must be top-level',t.line,t.column);
      const spec=this.expect('string').value;
      this.expect('as');const alias=this.expect('ident').value;this.statementEnd();
      return {kind:'Use',spec,alias,line:t.line,column:t.column};
    }
    if(this.accept('let')){
      const name=this.expect('ident').value;
      const annotation=this.accept(':')?this.typeName():null;
      this.expect('=');const value=this.expr();this.statementEnd();
      return annotation?{kind:'Let',name,annotation,value}:{kind:'Let',name,value};
    }
    if(this.accept('return')){const value=this.expr();this.statementEnd();return {kind:'Return',value};}
    if(this.accept('fn')){
      const name=this.expect('ident').value;this.expect('(');const params=[];
      if(!this.at(')')){do{const p=this.expect('ident').value;let type=null;if(this.accept(':'))type=this.typeName();params.push({name:p,type});}while(this.accept(','));}
      this.expect(')');let returnType=null;if(this.accept('->'))returnType=this.typeName();
      let body;
       if(this.at('{')) body=this.block();
       else {
         this.expect('return');
         const value=this.expr();
         this.statementEnd();
         body={kind:'Block',body:[{kind:'Return',value}]};
       }
       return {kind:'Function',name,params,returnType,body};
    }
    if(this.accept('if')){this.expect('(');const condition=this.expr();this.expect(')');const then=this.controlBody();const otherwise=this.accept('else')?this.controlBody():null;return {kind:'If',condition,then,otherwise};}
    if(this.accept('while')){this.expect('(');const condition=this.expr();this.expect(')');return {kind:'While',condition,body:this.controlBody()};}
    if(this.at('ident')&&this.peek(1).type==='='){
      const name=this.expect('ident').value;this.expect('=');const value=this.expr();this.statementEnd();return {kind:'Assign',name,value};
    }
    const value=this.expr();this.statementEnd();return {kind:'ExpressionStatement',value};
  }
  pipeTarget(){
    const token=this.peek();
    let callee;
    if(this.at('ident')){
      const head=this.expect('ident');
      if(this.accept('::')){
        const member=this.peek();
        if(!['ident','glyph'].includes(member.type))
          throw new HCodeError('Expected operation name or glyph after ::',member.line,member.column);
        this.i++;
        callee={kind:'QualifiedOperation',alias:head.value,member:member.value,isGlyph:member.type==='glyph',line:head.line,column:head.column};
      } else callee={kind:'Identifier',name:head.value};
    } else if(this.at('glyph')){
      const glyph=this.expect('glyph');
      callee={kind:'GlyphOperation',glyph:glyph.value,line:glyph.line,column:glyph.column};
    } else if(this.accept('(')){
      // M14 permits a parenthesized first-class operator section as a pipeline target.
      const sections=new Set(['*','/','%','+','<','>','<=','>=','==','!=']);
      if(sections.has(this.peek().type)){
        const operator=this.peek().type;
        this.i++;
        const right=this.expr();
        this.expect(')');
        return {callee:{kind:'Section',operator,right},args:[]};
      }
      callee=this.expr();
      this.expect(')');
      return {callee,args:[]};
    } else {
      throw new HCodeError('Pipeline target must be a callable name, package operation or parenthesized callable',token.line,token.column);
    }
    const args=[];
    if(this.accept('(')){
      if(!this.at(')')){do{args.push(this.expr());}while(this.accept(','));}
      this.expect(')');
    }
    return {callee,args};
  }
  expr(min=0){
    let left;
    if(this.accept('not'))left={kind:'Unary',operator:'not',value:this.expr(8)};
    else if(this.accept('-'))left={kind:'Unary',operator:'-',value:this.expr(8)};
    else if(this.accept('#'))left={kind:'Length',value:this.expr(8)};
    else if(this.accept('@+'))left={kind:'Sum',value:this.expr(8)};
    else if(this.accept('lambda')){
      const parameter=this.expect('ident').value;
      this.expect(':');
      const body=this.expr(0);
      left={kind:'Lambda',parameter,body};
    }
    else if(this.at('number'))left={kind:'Literal',value:this.expect('number').value};
    else if(this.at('string'))left={kind:'Literal',value:this.expect('string').value};
    else if(this.accept('true'))left={kind:'Literal',value:true};
    else if(this.accept('false'))left={kind:'Literal',value:false};
    else if(this.accept('[[')){
      const items=[];
      if(!this.at(']]')){do{items.push(this.expr());}while(this.accept(','));}
      this.expect(']]');left={kind:'Sequence',items};
    }
    else if(this.at('ident')){
      const t=this.expect('ident');
      if(this.accept('::')){
        const member=this.peek();
        if(!['ident','glyph'].includes(member.type))throw new HCodeError('Expected operation name or glyph after ::',member.line,member.column);
        this.i++;
        left={kind:'QualifiedOperation',alias:t.value,member:member.value,isGlyph:member.type==='glyph',line:t.line,column:t.column};
      } else left={kind:'Identifier',name:t.value};
    }
    else if(this.at('glyph')){const t=this.expect('glyph');left={kind:'GlyphOperation',glyph:t.value,line:t.line,column:t.column};}
    else if(this.accept('(')){
      const sections=new Set(['*','/','%','+','<','>','<=','>=','==','!=']);
      if(sections.has(this.peek().type)){
        const operator=this.peek().type;
        this.i++;
        const right=this.expr();
        this.expect(')');
        left={kind:'Section',operator,right};
      } else {left=this.expr();this.expect(')');}
    }
    else {const t=this.peek();throw new HCodeError(`Expected expression, got ${t.type}`,t.line,t.column);}
    while(true){
      if(this.at('[[')&&9>=min){
        this.expect('[[');const index=this.expr();this.expect(']]');
        left={kind:'Index',sequence:left,index};continue;
      }
      if(this.at('(')&&9>=min){
        this.expect('(');const args=[];
        if(!this.at(')')){do{args.push(this.expr());}while(this.accept(','));}
        this.expect(')');left={kind:'Call',callee:left,args};continue;
      }
      if(this.at('|>')&&min===0){
        this.expect('|>');
        const {callee,args}=this.pipeTarget();
        left={kind:'Call',callee,args:[left,...args]};
        const t=this.peek();
        if(['or','and','==','!=','<','>','<=','>=','+','-','*','/','%'].includes(t.type))
          throw new HCodeError('Parenthesize pipeline before another operator',t.line,t.column);
        continue;
      }
      if(this.at('?')&&min===0){
        this.expect('?');
        const whenTrue=this.expr();
        this.expect(':');
        const whenFalse=this.expr();
        left={kind:'Choice',condition:left,whenTrue,whenFalse};
        continue;
      }
      const op=this.peek().type;
      const power={or:1,and:2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6,'<<':7,'++':5,'@?':5,'@>':5}[op];
      if(power===undefined||power<min)break;
      this.i++;const right=this.expr(power+1);left={kind:'Binary',operator:op,left,right};
    }
    return left;
  }
}
export function parse(source){return new Parser(tokenize(source)).program();}

// Convert both glyph calls and ASCII package::operation calls to identical linked nodes.
// No ambient global registry: only explicitly imported, exact-version packages are visible.
export function linkProgram(ast, registry=new Map()) {
  if(!(registry instanceof Map))throw new TypeError('registry must be a Map');
  const imported=new Map(), glyphs=new Map(), byID=new Map();
  const uses=ast.body.filter(n=>n.kind==='Use');
  for(const use of uses){
    const match=/^([a-z][a-z0-9]*(?:[.-][a-z0-9]+)*)@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(use.spec);
    if(!match)throw new HCodeError(`Invalid package specifier ${JSON.stringify(use.spec)}; expected name@X.Y.Z`,use.line,use.column);
    const pkg=registry.get(use.spec);
    if(!pkg)throw new HCodeError(`Package ${use.spec} is not available in the locked registry`,use.line,use.column);
    if(imported.has(use.alias))throw new HCodeError(`Duplicate package alias ${use.alias}`,use.line,use.column);
    imported.set(use.alias,pkg);
    for(const op of pkg.manifest.operations){
      const id=`${use.spec}::${op.name}`;
      byID.set(id,op);
      const existing=glyphs.get(op.glyph)??new Set();existing.add(id);glyphs.set(op.glyph,existing);
    }
  }
  for(const stmt of ast.body){
    if((stmt.kind==='Let'||stmt.kind==='Function')&&imported.has(stmt.name))throw new HCodeError(`Declaration conflicts with import alias ${stmt.name}`);
  }
  function resolveRef(node){
    if(node.kind==='GlyphOperation'){
      const options=[...(glyphs.get(node.glyph)??[])];
      if(options.length===0)throw new HCodeError(`Unbound glyph ${node.glyph}; import a package that declares it`,node.line,node.column);
      if(options.length!==1)throw new HCodeError(`Ambiguous glyph ${node.glyph}; use packageAlias::operation`,node.line,node.column);
      return {kind:'OperationRef',id:options[0]};
    }
    const pkg=imported.get(node.alias);
    if(!pkg)throw new HCodeError(`Unknown package alias ${node.alias}`,node.line,node.column);
    const matches=pkg.manifest.operations.filter(op=>node.isGlyph?op.glyph===node.member:op.name===node.member);
    if(matches.length!==1)throw new HCodeError(`Unknown operation ${node.alias}::${node.member}`,node.line,node.column);
    return {kind:'OperationRef',id:`${pkg.manifest.name}@${pkg.manifest.version}::${matches[0].name}`};
  }
  const literalType=n=>{
    if(n.kind==='Literal')return typeof n.value==='number'?'Number':typeof n.value==='string'?'String':'Bool';
    if(n.kind==='Unary' && n.operator==='-' && literalType(n.value)==='Number')return 'Number';
    if(n.kind==='OperationRef')return null;
    if(n.kind==='Sequence'){
      if(!n.items.length)return null; // empty sequence type is inferred from the call
      const types=n.items.map(literalType);
      if(types.some(x=>x===null))return null;
      if(new Set(types).size!==1)throw new HCodeError('Sequence elements must have matching types');
      return '⟦'+types[0]+'⟧';
    }
    if(n.kind==='Call'&&n.callee.kind==='OperationRef')return byID.get(n.callee.id)?.returns??null;
    return null;
  };
  function expression(node){
    if(node.kind==='GlyphOperation'||node.kind==='QualifiedOperation')return resolveRef(node);
    if(node.kind==='Unary')return {...node,value:expression(node.value)};
    if(node.kind==='Sequence')return {...node,items:node.items.map(expression)};
    if(node.kind==='Index')return {...node,sequence:expression(node.sequence),index:expression(node.index)};
    if(node.kind==='Length')return {...node,value:expression(node.value)};
    if(node.kind==='Sum')return {...node,value:expression(node.value)};
    if(node.kind==='Lambda')return {...node,body:expression(node.body)};
    if(node.kind==='Section')return {...node,right:expression(node.right)};
    if(node.kind==='Binary')return {...node,left:expression(node.left),right:expression(node.right)};
    if(node.kind==='Choice')return {...node,condition:expression(node.condition),whenTrue:expression(node.whenTrue),whenFalse:expression(node.whenFalse)};
    if(node.kind==='Call'){
      const callee=expression(node.callee),args=node.args.map(expression);
      if(callee.kind==='OperationRef'){
        const contract=byID.get(callee.id);
        const line=node.callee.line??1,column=node.callee.column??1;
        if(args.length!==contract.parameters.length)throw new HCodeError(`${callee.id} expects ${contract.parameters.length} argument(s), got ${args.length}`,line,column);
        for(let i=0;i<args.length;i++){
          const observed=literalType(args[i]),expected=contract.parameters[i].type;
          if(observed&&observed!==expected)throw new HCodeError(`${callee.id} argument ${i+1} expects ${expected}, got ${observed}`,line,column);
        }
      }
      return {...node,callee,args};
    }
    return node;
  }
  function block(b){return {...b,body:b.body.map(statement)};}
  function statement(n){
    switch(n.kind){
      case 'Let':case 'Assign':case 'Return':case 'ExpressionStatement':return {...n,value:expression(n.value)};
      case 'Function':return {...n,body:block(n.body)};
      case 'If':return {...n,condition:expression(n.condition),then:block(n.then),otherwise:n.otherwise?block(n.otherwise):null};
      case 'While':return {...n,condition:expression(n.condition),body:block(n.body)};
      default:return n;
    }
  }
  return {kind:'Program',body:ast.body.map(statement)};
}

class Scope {
  constructor(parent=null){this.parent=parent;this.values=new Map();this.annotations=new Map();this.returnType=parent?.returnType??null;}
  define(name,value,type=null){if(this.values.has(name))throw Error(`Duplicate name ${name}`);this.values.set(name,value);this.annotations.set(name,type);}
  find(name){if(this.values.has(name))return this;if(this.parent)return this.parent.find(name);throw Error(`Unknown name ${name}`);}
  get(name){return this.find(name).values.get(name);}
  assign(name,value){this.find(name).values.set(name,value);}
}
class ReturnSignal{constructor(value){this.value=value;}}
const runtimeType=value=>value===null?'Unit':typeof value==='number'?'Number':typeof value==='string'?'String':typeof value==='boolean'?'Bool':'unsupported';

export function evaluate(ast,{stdout=()=>{},maxSteps=200000,maxSequenceItems=16384,registry=new Map()}={}){
  const root=new Scope(),operations=new Map(),operationSpecs=new Map(),loadedLibraries=new Set();let steps=0;
  const step=()=>{if(++steps>maxSteps)throw Error('Execution step limit exceeded');};
  root.define('print',(...args)=>{stdout(args.map(x=>x===null?'none':String(x)).join(' '));return null;});
  const truth=v=>{if(typeof v!=='boolean')throw Error('Condition must be Boolean');return v;};
  const requireType=(value,type,context='annotation')=>{
    if(!type)return;
    if(type.startsWith('⟦')&&type.endsWith('⟧')){
      if(!Array.isArray(value))throw Error(context==='return'?'return expects '+type+', got '+runtimeType(value):'Annotated type mismatch: expected '+type);
      if(value.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
      for(const element of value)requireType(element,type.slice(1,-1),context);
      return;
    }
    const actual=value===null?'Unit':typeof value==='number'?'Number':typeof value==='string'?'String':typeof value==='boolean'?'Bool':'Unknown';
    if(actual!==type||(type==='Number'&&!Number.isFinite(value)))throw Error(context==='return'?'return expects '+type+', got '+actual:'Annotated type mismatch: expected '+type+', got '+actual);
  };
  const unifySequenceTypes=(left,right)=>{
    if(left==='?')return right;
    if(right==='?')return left;
    if(left.startsWith('Sequence<') && right.startsWith('Sequence<')){
      return 'Sequence<'+unifySequenceTypes(left.slice(9,-1),right.slice(9,-1))+'>';
    }
    if(left!==right)throw Error('Sequence elements must have matching types');
    return left;
  };
  const seqElementType=v=>{
    if(Array.isArray(v)){
      let element='?';
      for(const item of v)element=unifySequenceTypes(element,seqElementType(item));
      return 'Sequence<'+element+'>';
    }
    return typeof v;
  };
  const validateSequence=v=>{
    if(!Array.isArray(v))throw Error('Expected sequence');
    if(v.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
    let element='?';
    for(const item of v)element=unifySequenceTypes(element,seqElementType(item));
    return v;
  };
  function expr(node,scope,expectedType=null,deferredEmpty=false){
    step();
    switch(node.kind){
      case 'Literal':return node.value;
      case 'Sequence':{
        const typed=typeof expectedType==='string' && expectedType.startsWith('⟦') && expectedType.endsWith('⟧');
        if(node.items.length===0){
          if(!typed && !deferredEmpty)throw Error('Cannot infer empty sequence type; add a type annotation');
          return validateSequence([]);
        }
        const inner=typed?expectedType.slice(1,-1):null;
        const values=validateSequence(node.items.map(x=>expr(x,scope,inner,true)));
        if(!typed&&!deferredEmpty&&seqElementType(values).includes('?')){
          throw Error('Cannot infer empty sequence type; add a type annotation');
        }
        return values;
      }
      case 'Index':{
        const seq=validateSequence(expr(node.sequence,scope)),i=expr(node.index,scope);
        if(typeof i!=='number'||!Number.isInteger(i)||i<0||i>=seq.length)throw Error('Sequence index out of bounds or not an integer');
        return seq[i];
      }
      case 'Length':return validateSequence(expr(node.value,scope)).length;
      case 'Sum':{
        const xs=validateSequence(expr(node.value,scope,'⟦Number⟧'));
        let total=0;
        for(const v of xs){
          step();
          if(typeof v!=='number')throw Error('∑ requires a numeric sequence');
          total+=v;
        }
        return total;
      }
      case 'Identifier':return scope.get(node.name);
      case 'Section':{
        const captured=expr(node.right,scope);
        const op=node.operator;
        if(['+','*','/','%','<','>','<=','>='].includes(op)){
          if(op==='+' && typeof captured!=='number' && typeof captured!=='string')throw Error('Operator section + expects Number or String');
          if(op!=='+' && typeof captured!=='number')throw Error('Operator section expects Numbers');
        }
        return (...args)=>{
          step();
          if(args.length!==1)throw Error('Operator section expects exactly one argument');
          const left=args[0];
          if(op==='==')return typeof left===typeof captured&&left===captured;
          if(op==='!=')return !(typeof left===typeof captured&&left===captured);
          if(op==='+' && typeof left==='string' && typeof captured==='string')return left+captured;
          if(typeof left!=='number'||typeof captured!=='number')throw Error('Operator section expects Numbers');
          if((op==='/'||op==='%')&&captured===0)throw Error('Division by zero');
          switch(op){
            case '+':return left+captured;
            case '*':return left*captured;
            case '/':return left/captured;
            case '%':return left%captured;
            case '<':return left<captured;
            case '>':return left>captured;
            case '<=':return left<=captured;
            case '>=':return left>=captured;
            default:throw Error('Unknown operator section');
          }
        };
      }
      case 'Lambda':
        return (...args)=>{
          step();
          if(args.length!==1)throw Error('λ expects exactly one argument');
          const closureScope=new Scope(scope);
          closureScope.define(node.parameter,args[0]);
          return expr(node.body,closureScope);
        };
      case 'OperationRef':{
        const fn=operations.get(node.id);
        if(!fn)throw Error(`Unlinked operation ${node.id}`);
        return fn;
      }
      case 'Unary':{
        const v=expr(node.value,scope);
        if(node.operator==='not')return !truth(v);
        if(typeof v!=='number')throw Error('Unary minus expects Number');return -v;
      }
      case 'Choice':{
        const test=truth(expr(node.condition,scope));
        return test?expr(node.whenTrue,scope):expr(node.whenFalse,scope);
      }
      case 'Binary':{
        const op=node.operator;
        const a=expr(node.left,scope,null,op==='@?'||op==='@>');
        if(op==='@?'||op==='@>'){
          const source=validateSequence(a);
          const fn=expr(node.right,scope);
          if(typeof fn!=='function')throw Error(op==='@?'?'⌕ requires a unary predicate':'⇢ requires a unary transform');
          const out=[];
          for(const item of source){
            step();
            const value=fn(item);
            if(op==='@?'){
              if(typeof value!=='boolean')throw Error('⌕ predicate must return Bool');
              if(value)out.push(item);
            }else out.push(value);
            if(out.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
          }
          return validateSequence(out);
        }
        if(op==='++'){
          const b=expr(node.right,scope);
          const x=validateSequence(a),y=validateSequence(b);
          if(x.length+y.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
          return validateSequence([...x,...y]);
        }
        if(op==='<<'){
          const b=expr(node.right,scope);
          if(typeof a!=='function'||typeof b!=='function')throw Error('Composition expects unary functions');
          return x=>{step();return a(b(x));};
        }
        if(op==='and')return truth(a)?truth(expr(node.right,scope)):false;
        if(op==='or')return truth(a)?true:truth(expr(node.right,scope));
        const b=expr(node.right,scope);
        if(op==='==')return typeof a===typeof b&&a===b;
        if(op==='!=')return !(typeof a===typeof b&&a===b);
        if(op==='+'&&typeof a==='string'&&typeof b==='string')return a+b;
        if(['+','-','*','/','%','<','>','<=','>='].includes(op)){
          if(typeof a!=='number'||typeof b!=='number')throw Error(`${op} expects Numbers`);
          if((op==='/'||op==='%')&&b===0)throw Error('Division by zero');
          return {'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'%':()=>a%b,'<':()=>a<b,'>':()=>a>b,'<=':()=>a<=b,'>=':()=>a>=b}[op]();
        }
        throw Error(`Unknown binary operator ${op}`);
      }
      case 'Call':{
        const fun=expr(node.callee,scope);if(typeof fun!=='function')throw Error('Value is not callable');
        const signature=node.callee.kind==='OperationRef'?operationSpecs.get(node.callee.id):null;
        const args=node.args.map((arg,i)=>expr(arg,scope,signature?.parameters[i]?.type??null));
        return fun(...args);
      }
      default:throw Error(`Unsupported AST expression ${node.kind}`);
    }
  }
  function block(node,parent){const scope=new Scope(parent);for(const statement of node.body)stmt(statement,scope);}
  function stmt(node,scope){
    step();
    switch(node.kind){
      case 'Use':break;
      case 'Let':{
        const val=expr(node.value,scope,node.annotation??null);
        requireType(val,node.annotation??null);
        scope.define(node.name,val,node.annotation??null);
        break;
      }
      case 'Assign':{
        const binding=scope.find(node.name);
        const type=binding.annotations.get(node.name);
        const val=expr(node.value,scope,type);
        requireType(val,type);
        scope.assign(node.name,val);
        break;
      }
      case 'ExpressionStatement':expr(node.value,scope);break;
      case 'Return':throw new ReturnSignal(expr(node.value,scope,scope.returnType));
      case 'Function':{
        const fn=(...args)=>{
          step();
          if(args.length!==node.params.length)throw Error(`${node.name} expects ${node.params.length} arguments`);
          const inner=new Scope(scope);inner.returnType=node.returnType;
          for(let j=0;j<args.length;j++){
            requireType(args[j],node.params[j].type);
            inner.define(node.params[j].name,args[j],node.params[j].type);
          }
          try{for(const statement of node.body.body)stmt(statement,inner);}catch(e){if(e instanceof ReturnSignal){requireType(e.value,node.returnType,'return');return e.value;}throw e;}
          return null;
        };
        scope.define(node.name,fn);break;
      }
      case 'If':block(truth(expr(node.condition,scope))?node.then:(node.otherwise??{kind:'Block',body:[]}),scope);break;
      case 'While':while(truth(expr(node.condition,scope))){step();block(node.body,scope);}break;
      default:throw Error(`Unsupported AST statement ${node.kind}`);
    }
  }
  // Library functions run in an isolated scope with NO ambient print, IO or host JS access.
  for(const node of ast.body.filter(n=>n.kind==='Use')){
    const pkg=registry.get(node.spec);
    if(!pkg)throw Error(`Unlinked import ${node.spec}`);
    if(loadedLibraries.has(node.spec))continue;
    loadedLibraries.add(node.spec);
    const libraryScope=new Scope();
    for(const declaration of pkg.ast.body)stmt(declaration,libraryScope);
    for(const operation of pkg.manifest.operations){
      const implementation=libraryScope.get(operation.implementation);
      const id=`${node.spec}::${operation.name}`;
      operations.set(id,(...args)=>{
        step();
        if(args.length!==operation.parameters.length)throw Error(`${id} expects ${operation.parameters.length} argument(s)`);
        for(let j=0;j<args.length;j++){
          const actual=runtimeType(args[j]),expected=operation.parameters[j].type;
          if(actual!==expected)throw Error(`${id}: argument ${j+1} (${operation.parameters[j].name}) expects ${expected}, got ${actual}`);
        }
        const result=implementation(...args);
        const actual=runtimeType(result);
        if(actual!==operation.returns)throw Error(`${id}: return expects ${operation.returns}, got ${actual}`);
        return result;
      });
    }
  }
  for(const statement of ast.body)stmt(statement,root);
  return {steps};
}
export function execute(source,options={}){
  const registry=options.registry??new Map();
  return evaluate(linkProgram(parse(source),registry),{...options,registry});
}
