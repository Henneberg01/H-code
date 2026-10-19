// H-Code M1 reference interpreter and symbol linker. NOT a production compiler.
import {specializeCall,checkSpecializedReturn,typeToString} from './package-v3-signatures.mjs';
import {decodeTypedCSV} from './csv-pure.mjs';
import {readMarkdownTokens} from './markdown-reference.mjs';
import {safeArithmetic,ArithmeticInputError} from './arithmetic-pure.mjs';
export const CORE_GLYPHS = Object.freeze({
  '\u0192': 'fn', '\u2254': 'let', '\u21a9': 'return', '\u2192': '->',
  '\u2190': '=', '\u22a4': 'true', '\u22a5': 'false',
  '\u2227': 'and', '\u2228': 'or', '\u00ac': 'not',
  '\u2261': '==', '\u2260': '!=', '\u2264': '<=', '\u2265': '>=',
  '\u22a2': 'if', '\u22a3': 'else', '\u27f3': 'while', '\u21d2': '=>',
  '\u2237': '::', '\u25b7': '|>', '\u2218': '<<', '\u25c7': '?', '\u27e6': '[[', '\u27e7': ']]',
  '\u2983':'record-open', '\u2984':'record-close', '\u00b7':'field', '\u229e':'record-update',
  '\u2913':'json-read', '\u2914':'json-valid', '\u2912':'json-write',
  '⟐':'dom_value', '⟑':'dom_text', '⟒':'dom_valid', '⟓':'dom_on', '⟔':'dom_attr', '⟘':'dom_list',
  '⟕':'store_get', '⟖':'store_put', '⟗':'store_del',
  '\u2af6':'text-scalars', '\u27df':'text-words', '\u29c9':'histogram', '\u224b':'markdown-tokens',
  '\u29c4':'file-read', '\u29c5':'file-write', '\u290b':'http-get', '\u290a':'http-serve', '\u231b':'sleep-ms', '\u29c7':'csv-typed',
  '\u2328':'stdin-text', '\u2a5a':'arith-eval', '\u2317': '#', '\u29fa': '++', '\u2211': '@+', '\u2315': '@?', '\u21e2': '@>', '\u03bb': 'lambda', '\u2200': 'forall'
});
export const RESERVED_USER_GLYPHS = new Set(['\u2205', '\u2200', '\u2208', ...Object.keys(CORE_GLYPHS)]);
const RESERVED = new Set(['fn','let','return','true','false','if','else','while','and','or','not','use','as','lambda','forall','json_in','json_valid','json_out','text_scalars','text_words','text_hist','markdown_tokens','file_read','file_write','http_get','http_serve','sleep_ms','csv_typed','stdin_text','arith_eval']);
const TWO = new Set(['==','!=','<=','>=','->','::','|>','<<','[[',']]','++','@+','@?','@>','=>','<+']);
const ONE = new Set(['+','-','*','/','%','<','>','=','(',')','{','}',',',';',':','?','#','.']);
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]|\p{Default_Ignorable_Code_Point}/u;
const SYMBOL_CHARACTER = /^\p{S}$/u;

// Reference interpreter suspends on HTTP and replays the deterministic pure
// prefix after receiving a host-injected result. This is NOT a production async
// engine; the source program, not JavaScript glue, owns retry policy and state.
class PendingHttpEffect extends Error {
  constructor(url,index){super('Pending H-Code HTTP request');this.url=url;this.index=index;}
}
class PendingSleepEffect extends Error {
  constructor(ms,index){super('Pending H-Code delay');this.ms=ms;this.index=index;}
}
class PendingFileWriteEffect extends Error {
  constructor(filename,content,index,byteLength){
    super('Pending H-Code file write');
    this.filename=filename;this.content=content;this.index=index;this.byteLength=byteLength;
  }
}
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
      emit(word==='json_in'?'json-read':word==='json_valid'?'json-valid':word==='json_out'?'json-write':word==='text_scalars'?'text-scalars':word==='text_words'?'text-words':word==='text_hist'?'histogram':word==='markdown_tokens'?'markdown-tokens':word==='file_read'?'file-read':word==='file_write'?'file-write':word==='http_get'?'http-get':word==='http_serve'?'http-serve':word==='sleep_ms'?'sleep-ms':word==='csv_typed'?'csv-typed':word==='stdin_text'?'stdin-text':word==='arith_eval'?'arith-eval':(RESERVED.has(word)?word:'ident'),word,ln,col);continue;
    }
    if(Object.hasOwn(CORE_GLYPHS,c)){
      advance();const alias=CORE_GLYPHS[c];
      emit(alias.startsWith('dom_')||alias.startsWith('store_')?'ident':alias,alias,ln,col);continue;
    }
    const two=c+(peek(1)??'');
    if(TWO.has(two)){advance();advance();emit(two==='<+'?'record-update':two,two,ln,col);continue;}
    if(ONE.has(c)){advance();emit(c==='.'?'field':c,c,ln,col);continue;}
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
    const certain=new Set(['fn','let','return','if','while','use','import','export','else','forall']);
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
    if(this.at('record-open')||this.at('{')){
      const closing=this.accept('record-open')?'record-close':(this.expect('{'),'}');
      const fields=[],keys=new Set();
      while(!this.at(closing)){
        if(fields.length>=64)throw new HCodeError('Record type exceeds 64 fields',this.peek().line,this.peek().column);
        const key=this.expect('ident');
        if(keys.has(key.value))throw new HCodeError('Duplicate record field '+key.value,key.line,key.column);
        keys.add(key.value);this.expect(':');
        fields.push(key.value+':'+this.typeName());
        if(!this.accept(','))break;
      }
      this.expect(closing);
      return '⦃'+fields.join(',')+'⦄';
    }
    return this.expect('ident').value;
  }
  stmt(topLevel=false){
    if(this.accept('forall')){
      if(!topLevel)throw new HCodeError('∀ declarations must be top-level');
      const typeParameters=[];
      do {
        const t=this.expect('ident'),v=t.value;
        if(!/^[A-Z][A-Za-z0-9_]*$/.test(v)||v.length>32||
            ['Number','String','Bool','Unit'].includes(v)||
            typeParameters.includes(v)||typeParameters.length>=8)
          throw new HCodeError('Invalid or duplicate ∀ binder '+v,t.line,t.column);
        typeParameters.push(v);
      } while(this.accept(','));
      if(!this.at('fn'))throw new HCodeError('∀ must bind a function');
      const declaration=this.stmt(topLevel);
      if(declaration.kind!=='Function')throw new HCodeError('∀ must bind a function');
      return {...declaration,typeParameters};
    }
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
    else if(this.accept('stdin-text'))left={kind:'StdinText'};
    else if(this.accept('arith-eval'))left={kind:'ArithEval',value:this.expr(8)};
    else if(this.accept('markdown-tokens'))left={kind:'Markdown',value:this.expr(8)};
    else if(this.accept('file-read'))left={kind:'FileRead',value:this.expr(8)};
    else if(this.accept('file-write')){
      this.expect('(');
      const filename=this.expr();this.expect(',');const content=this.expr();
      this.expect(')');left={kind:'FileWrite',filename,content};
    }
    else if(this.accept('http-get'))left={kind:'HttpGet',value:this.expr(8)};
    else if(this.accept('http-serve')){
      if(this.accept('(')){
        const handler=this.expr(0);this.expect(',');const initial=this.expr(0);this.expect(')');
        left={kind:'HttpServeState',handler,initial};
      } else left={kind:'HttpServe',value:this.expr(8)};
    }
    else if(this.accept('sleep-ms'))left={kind:'Sleep',value:this.expr(8)};
    else if(this.accept('csv-typed')){
      const schema=this.typeName();
      left={kind:'CsvTyped',schema,value:this.expr(8)};
    }
    else if(this.accept('text-scalars'))left={kind:'TextScalars',value:this.expr(8)};
    else if(this.accept('text-words'))left={kind:'TextWords',value:this.expr(8)};
    else if(this.accept('histogram'))left={kind:'Histogram',value:this.expr(8)};
    else if(this.accept('#'))left={kind:'Length',value:this.expr(8)};
    else if(this.accept('@+'))left={kind:'Sum',value:this.expr(8)};
    else if(this.accept('lambda')){
      const parameter=this.expect('ident').value;
      this.expect(':');
      const body=this.expr(0);
      left={kind:'Lambda',parameter,body};
    }
    else if(this.accept('json-read')){
      const schema=this.typeName();
      left={kind:'JsonRead',schema,value:this.expr(8)};
    }
    else if(this.accept('json-valid')){
      const schema=this.typeName();
      left={kind:'JsonValid',schema,value:this.expr(8)};
    }
    else if(this.accept('json-write'))left={kind:'JsonWrite',value:this.expr(8)};
    else if(this.at('number'))left={kind:'Literal',value:this.expect('number').value};
    else if(this.at('string'))left={kind:'Literal',value:this.expect('string').value};
    else if(this.accept('true'))left={kind:'Literal',value:true};
    else if(this.accept('false'))left={kind:'Literal',value:false};
    else if(this.accept('[[')){
      const items=[];
      if(!this.at(']]')){do{items.push(this.expr());}while(this.accept(','));}
      this.expect(']]');left={kind:'Sequence',items};
    }
    else if(this.at('record-open')||this.at('{')){
      const closing=this.accept('record-open')?'record-close':(this.expect('{'),'}');
      const fields=[],keys=new Set();
      while(!this.at(closing)){
        if(fields.length>=64)throw new HCodeError('Record exceeds 64 fields',this.peek().line,this.peek().column);
        const key=this.expect('ident');
        if(keys.has(key.value))throw new HCodeError('Duplicate record field '+key.value,key.line,key.column);
        keys.add(key.value);this.expect(':');
        fields.push({name:key.value,value:this.expr()});
        if(!this.accept(','))break;
      }
      this.expect(closing);left={kind:'Record',fields};
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
      if(this.at('field')&&9>=min){
        this.expect('field');
        const t=this.expect('ident');
        left={kind:'Field',record:left,name:t.value};continue;
      }
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
      if(this.at('record-update')&&min===0){
        this.expect('record-update');
        const key=this.expect('ident').value;
        this.expect(':');const value=this.expr(0);
        left={kind:'RecordUpdate',record:left,name:key,value};continue;
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
    if(n.kind==='Record'){
      const fields=n.fields.map(f=>[f.name,literalType(f.value)]);
      if(fields.some(([,ty])=>ty===null))return null;
      fields.sort((a,b)=>a[0].localeCompare(b[0],'en'));
      return '⦃'+fields.map(([k,ty])=>k+':'+ty).join(',')+'⦄';
    }
    if(n.kind==='Sequence'){
      if(!n.items.length)return null; // empty sequence type is inferred from the call
      const types=n.items.map(literalType);
      if(types.some(x=>x===null))return null;
      if(new Set(types).size!==1)throw new HCodeError('Sequence elements must have matching types');
      return '⟦'+types[0]+'⟧';
    }
    if(n.kind==='Call'&&n.callee.kind==='OperationRef'){
      const op=byID.get(n.callee.id);
      return op?.typeParameters?.length?null:(op?.returns??null);
    }
    return null;
  };
  function expression(node){
    if(node.kind==='GlyphOperation'||node.kind==='QualifiedOperation')return resolveRef(node);
    if(node.kind==='Unary')return {...node,value:expression(node.value)};
    if(node.kind==='Sequence')return {...node,items:node.items.map(expression)};
    if(node.kind==='Record')return {...node,fields:node.fields.map(f=>({name:f.name,value:expression(f.value)}))};
    if(node.kind==='Field')return {...node,record:expression(node.record)};
    if(node.kind==='JsonRead'||node.kind==='JsonValid'||node.kind==='JsonWrite'||node.kind==='TextScalars'||node.kind==='TextWords'||node.kind==='Histogram'||node.kind==='Markdown'||node.kind==='FileRead'||node.kind==='HttpGet'||node.kind==='HttpServe'||node.kind==='Sleep'||node.kind==='CsvTyped'||node.kind==='ArithEval')return {...node,value:expression(node.value)};
    if(node.kind==='FileWrite')return {...node,filename:expression(node.filename),content:expression(node.content)};
    if(node.kind==='HttpServeState')return {...node,handler:expression(node.handler),initial:expression(node.initial)};
    if(node.kind==='RecordUpdate')return {...node,record:expression(node.record),value:expression(node.value)};
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
          if(observed&&!(contract.typeParameters?.length)&&observed!==expected)throw new HCodeError(`${callee.id} argument ${i+1} expects ${expected}, got ${observed}`,line,column);
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
  constructor(parent=null){this.parent=parent;this.values=new Map();this.annotations=new Map();this.returnType=parent?.returnType??null;this.genericBindings=parent?.genericBindings??new Map();}
  define(name,value,type=null){
    if(this.parent&&['dom_value','dom_text','dom_valid','dom_on','dom_attr','dom_list','store_get','store_put','store_del'].includes(name))
      throw Error('Reserved core browser DOM capability cannot be shadowed');
    if(this.values.has(name))throw Error(`Duplicate name ${name}`);
    this.values.set(name,value);this.annotations.set(name,type);
  }
  find(name){if(this.values.has(name))return this;if(this.parent)return this.parent.find(name);throw Error(`Unknown name ${name}`);}
  get(name){return this.find(name).values.get(name);}
  assign(name,value){this.find(name).values.set(name,value);}
}
class ReturnSignal{constructor(value){this.value=value;}}
const runtimeType=value=>value===null?'Unit':typeof value==='number'?'Number':typeof value==='string'?'String':typeof value==='boolean'?'Bool':'unsupported';

export function evaluate(ast,{stdout=()=>{},maxSteps=200000,maxSequenceItems=16384,registry=new Map(),readFile=null,readStdin=null,httpEffects=null,httpServe=null,httpServeState=null,sleepEffects=null,fileEffects=null,domHost=null,storageHost=null}={}){
  const root=new Scope(),operations=new Map(),operationSpecs=new Map(),loadedLibraries=new Set();let steps=0,stdinConsumed=false,httpIndex=0,sleepIndex=0,fileIndex=0,pureDepth=0,functionDepth=0,httpServerRegistered=false;
  const step=()=>{if(++steps>maxSteps)throw Error('Execution step limit exceeded');};
  root.define('print',(...args)=>{if(pureDepth>0)throw Error('CAS reducer effect denied: print');stdout(args.map(x=>x===null?'none':String(x)).join(' '));return null;});

  // Independent browser-host reference semantics. Unlike Rust generated ESM,
  // this interpreter receives an explicit host; no implicit document access.
  const domTarget=selector=>{
    step();
    if(pureDepth>0)throw Error('DOM effect denied in CAS reducer');
    if(typeof selector!=='string'||selector.length<1||selector.length>256||!selector.isWellFormed())
      throw TypeError('DOM selector must be well-formed String (1..256)');
    if(!domHost||typeof domHost.querySelector!=='function')
      throw Error('Browser DOM capability unavailable');
    const element=domHost.querySelector(selector);
    if(!element)throw Error('DOM target not found');
    return element;
  };
  const domBounded=(value,max=16384)=>{
    if(typeof value!=='string'||!value.isWellFormed()||
       new TextEncoder().encode(value).length>max)
      throw TypeError('DOM text must be bounded well-formed String');
    return value;
  };
  root.define('dom_value',selector=>{
    const element=domTarget(selector);
    const value=typeof element.value==='string'?element.value:element.textContent;
    return domBounded(value??'');
  });
  root.define('dom_text',(selector,value)=>{
    domTarget(selector).textContent=domBounded(value);
    return null;
  });
  root.define('dom_valid',selector=>{
    const el=domTarget(selector);
    if(typeof el.checkValidity!=='function')throw TypeError('DOM target has no native constraint validation');
    const valid=el.checkValidity();
    if(typeof valid!=='boolean')throw TypeError('DOM validity must be Bool');
    return valid;
  });
  root.define('dom_attr',(selector,attribute,value)=>{
    const el=domTarget(selector);
    if(typeof attribute!=='string'||
       !/^(?:aria-[a-z][a-z0-9-]*|role|title|data-hcode-[a-z0-9-]+)$/.test(attribute))
      throw TypeError('DOM attribute not in safe accessibility/data allowlist');
    if(typeof el.setAttribute!=='function')throw TypeError('DOM attribute setter unavailable');
    el.setAttribute(attribute,domBounded(value,2048));
    return null;
  });
  root.define('dom_list',(selector,labels)=>{
    const element=domTarget(selector);
    if(typeof element.tagName!=='string'||
       !['UL','OL'].includes(element.tagName.toUpperCase()))
      throw TypeError('DOM list target must be ul or ol');
    if(!Array.isArray(labels)||labels.length>1024)
      throw TypeError('DOM list requires at most 1024 String items');
    if(typeof element.replaceChildren!=='function'||
       !domHost||typeof domHost.createElement!=='function')
      throw TypeError('DOM list host lacks safe element APIs');
    const children=labels.map(label=>{
      const li=domHost.createElement('li');
      li.textContent=domBounded(label,2048);
      return li;
    });
    element.replaceChildren(...children);
    return null;
  });
  let domListeners=0;
  root.define('dom_on',(selector,eventName,handler)=>{
    const el=domTarget(selector);
    if(!['input','change','submit','click','blur','focus'].includes(eventName))
      throw TypeError('DOM event name is not permitted');
    if(typeof handler!=='function')throw TypeError('DOM event handler must be a function');
    if(typeof el.addEventListener!=='function')throw TypeError('DOM target cannot receive events');
    if(domListeners>=256)throw RangeError('DOM listener budget exceeded');
    el.addEventListener(eventName,event=>{
      step();
      const value=event?.target&&typeof event.target.value==='string'?event.target.value:'';
      const accepted=handler(domBounded(value));
      if(typeof accepted!=='boolean')throw TypeError('DOM event handler must return Bool');
      if(!accepted&&event?.cancelable&&typeof event.preventDefault==='function')event.preventDefault();
    },{passive:false});
    domListeners++;
    return null;
  });

  // M19.14 B1: explicit host-injected same-origin storage capability.
  // The reference interpreter cannot silently read Node filesystem or global state.
  const storeKey=key=>{
    step();
    if(pureDepth>0)throw Error('Browser storage effect denied in CAS reducer');
    if(typeof key!=='string'||!/^hcode:[a-z][a-z0-9._-]{0,63}$/.test(key))
      throw TypeError('Storage key must be a namespaced hcode: String');
    if(!storageHost||typeof storageHost.getItem!=='function'||
       typeof storageHost.setItem!=='function'||typeof storageHost.removeItem!=='function')
      throw Error('Browser storage capability unavailable');
    return key;
  };
  const storeText=value=>{
    if(typeof value!=='string'||!value.isWellFormed()||
       new TextEncoder().encode(value).length>65536)
      throw TypeError('Storage value must be well-formed String of at most 65536 UTF-8 bytes');
    return value;
  };
  root.define('store_get',key=>{
    const name=storeKey(key);
    const value=storageHost.getItem(name);
    if(value===null)return '';
    return storeText(value);
  });
  root.define('store_put',(key,value)=>{
    const name=storeKey(key);
    storageHost.setItem(name,storeText(value));
    return null;
  });
  root.define('store_del',key=>{
    const name=storeKey(key);
    storageHost.removeItem(name);
    return null;
  });

  const truth=v=>{if(typeof v!=='boolean')throw Error('Condition must be Boolean');return v;};
  // The parser emits ⦃name:Type,...⦄. Split top-level commas without
  // losing recursively nested sequence/record types.
  const recordAnnotationFields=type=>{
    if(!(type.startsWith('⦃')&&type.endsWith('⦄')))throw Error('Invalid record type');
    const body=type.slice(1,-1),parts=[];
    let open=[],begin=0;
    for(const [i,c] of [...body].entries()){
      if(c==='⦃'||c==='⟦')open.push(c);
      else if(c==='⦄'||c==='⟧'){
        if(open.pop()!==(c==='⦄'?'⦃':'⟦'))throw Error('Invalid nested record annotation');
      } else if(c===','&&!open.length){
        parts.push(body.slice(begin,i));begin=i+1;
      }
    }
    if(open.length)throw Error('Unclosed record annotation');
    if(body)parts.push(body.slice(begin));
    if(parts.length>64)throw Error('Record field limit exceeded');
    const seen=new Set();
    return parts.map(part=>{
      const index=part.indexOf(':');
      if(index<=0)throw Error('Invalid record annotation');
      const key=part.slice(0,index),value=part.slice(index+1);
      if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)||seen.has(key)||!value)throw Error('Invalid or duplicate record field');
      seen.add(key);return [key,value];
    });
  };
  const requireType=(value,type,context='annotation')=>{
    if(!type)return;
    if(type.startsWith('⟦')&&type.endsWith('⟧')){
      if(!Array.isArray(value))throw Error(context==='return'?'return expects '+type+', got '+runtimeType(value):'Annotated type mismatch: expected '+type);
      if(value.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
      for(const element of value)requireType(element,type.slice(1,-1),context);
      return;
    }
    if(type.startsWith('⦃')&&type.endsWith('⦄')){
      const fields=recordAnnotationFields(type);
      const valid=value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===null;
      if(!valid||Object.keys(value).length!==fields.length||fields.some(([key])=>!Object.hasOwn(value,key)))
        throw Error(context==='return'?'return expects '+type+', got record mismatch':'Annotated type mismatch: expected '+type);
      for(const [key,fieldType] of fields)requireType(value[key],fieldType,context);
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
    if(v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===null){
      const keys=Object.keys(v).sort();
      return 'Record<'+keys.map(key=>key+':'+seqElementType(v[key])).join(',')+'>';
    }
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
  const JSON_MAX_BYTES=1048576,JSON_MAX_DEPTH=32;
  const jsonBytes=s=>new TextEncoder().encode(s).length;
  const verifyJsonSchema=(annotation,depth=0)=>{
    if(depth>JSON_MAX_DEPTH)throw Error('JSON schema nesting depth exceeded');
    if(['Number','String','Bool'].includes(annotation))return;
    if(annotation.startsWith('⟦')&&annotation.endsWith('⟧'))
      return verifyJsonSchema(annotation.slice(1,-1),depth+1);
    if(annotation.startsWith('⦃')&&annotation.endsWith('⦄')){
      for(const [,ty] of recordAnnotationFields(annotation))verifyJsonSchema(ty,depth+1);
      return;
    }
    throw Error('⤓ schema must be a concrete JSON-compatible type');
  };
  const jsonReadCheck=(value,schema,depth=0)=>{
    step();if(depth>JSON_MAX_DEPTH)throw Error('JSON nesting depth exceeded');
    if(schema==='Number'){if(typeof value!=='number'||!Number.isFinite(value))throw Error('JSON Number type mismatch');return value;}
    if(schema==='String'){if(typeof value!=='string'||!value.isWellFormed())throw Error('JSON String type mismatch');return value;}
    if(schema==='Bool'){if(typeof value!=='boolean')throw Error('JSON Bool type mismatch');return value;}
    if(schema.startsWith('⟦')&&schema.endsWith('⟧')){
      if(!Array.isArray(value))throw Error('JSON Sequence type mismatch');
      if(value.length>maxSequenceItems)throw Error('JSON Sequence length exceeded');
      return Object.freeze(value.map(item=>jsonReadCheck(item,schema.slice(1,-1),depth+1)));
    }
    if(schema.startsWith('⦃')&&schema.endsWith('⦄')){
      if(value===null||typeof value!=='object'||Array.isArray(value))throw Error('JSON Record type mismatch');
      const proto=Object.getPrototypeOf(value);
      if(proto!==null&&proto!==Object.prototype)throw Error('JSON Record prototype mismatch');
      const fields=recordAnnotationFields(schema).sort((a,b)=>a[0].localeCompare(b[0],'en'));
      if(Object.keys(value).length!==fields.length)throw Error('JSON Record shape mismatch');
      const out=Object.create(null);
      for(const [key,type] of fields){
        if(!Object.hasOwn(value,key))throw Error('JSON Record missing field '+key);
        out[key]=jsonReadCheck(value[key],type,depth+1);
      }
      return Object.freeze(out);
    }
    throw Error('Invalid internal JSON schema');
  };
  const jsonWriteCheck=(value,depth=0)=>{
    step();if(depth>JSON_MAX_DEPTH)throw Error('JSON nesting depth exceeded');
    if(typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(Array.isArray(value)){
      if(value.length>maxSequenceItems)throw Error('JSON Sequence length exceeded');
      validateSequence(value);
      return Object.freeze(value.map(item=>jsonWriteCheck(item,depth+1)));
    }
    if(value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===null){
      const keys=Object.keys(value).sort();
      if(keys.length>64)throw Error('JSON Record field limit exceeded');
      const out=Object.create(null);
      for(const key of keys)out[key]=jsonWriteCheck(value[key],depth+1);
      return Object.freeze(out);
    }
    throw Error('⤒ requires typed JSON-compatible data');
  };
  // H-Code's Unicode operations are reusable typed data primitives,
  // not per-benchmark output templates. Scalar ordering is codepoint order
  // (not locale-dependent); tokenization is explicit NFC+lowercase+Unicode.
  const TEXT_MAX_BYTES=1048576;
  const textCheck=value=>{
    step();
    if(typeof value!=='string')throw Error('Unicode text operation requires String');
    let n=0;
    for(const ch of value){
      if((++n & 255)===0)step();
      const cp=ch.codePointAt(0);
      if(cp>=0xD800&&cp<=0xDFFF)throw Error('Unpaired UTF-16 surrogate');
    }
    if(jsonBytes(value)>TEXT_MAX_BYTES)throw Error('Unicode text exceeds 1 MiB UTF-8');
    return value;
  };
  const unicodeCompare=(a,b)=>{
    const x=[...a],y=[...b];
    for(let i=0;i<Math.min(x.length,y.length);i++){
      const diff=x[i].codePointAt(0)-y[i].codePointAt(0);
      if(diff)return diff;
    }
    return x.length-y.length;
  };
  const textScalars=value=>{
    const out=[];
    for(const ch of textCheck(value)){
      step();out.push(ch);
      if(out.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
    }
    return validateSequence(out);
  };
  const textWords=value=>{
    const text=textCheck(value).normalize('NFC').toLowerCase().normalize('NFC');
    if(jsonBytes(text)>TEXT_MAX_BYTES)throw Error('Normalized text exceeds 1 MiB UTF-8');
    const out=[];
    for(const match of text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}\p{Pc}]*/gu)){
      step();out.push(match[0]);
      if(out.length>maxSequenceItems)throw Error('Sequence allocation limit exceeded');
    }
    return validateSequence(out);
  };
  const histogram=input=>{
    const xs=validateSequence(input),counts=new Map();
    let kind=null,bytes=0;
    for(const value of xs){
      step();
      const actual=typeof value;
      if(actual!=='string'&&actual!=='number'&&actual!=='boolean')
        throw Error('⧉ requires String, Number, or Bool values');
      if(kind!==null&&actual!==kind)throw Error('⧉ requires homogeneous sequence');
      kind=actual;
      if(actual==='number'&&!Number.isFinite(value))throw Error('⧉ requires finite Number keys');
      if(actual==='string'){
        textCheck(value);
        bytes+=jsonBytes(value);
        if(bytes>TEXT_MAX_BYTES)throw Error('Histogram text exceeds 1 MiB UTF-8');
      }
      const key=value===0?0:value;
      counts.set(key,(counts.get(key)||0)+1);
    }
    const comparator=kind==='string'?
      (a,b)=>unicodeCompare(a[0],b[0]):(a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0;
    const result=[...counts.entries()].sort(comparator).map(([value,count])=>{
      step();const row=Object.create(null);row.count=count;row.value=value;
      return Object.freeze(row);
    });
    return validateSequence(result);
  };
  function expr(node,scope,expectedType=null,deferredEmpty=false){
    step();
    switch(node.kind){
      case 'StdinText':{
        if(stdinConsumed)throw new ArithmeticInputError('stdin already consumed');
        stdinConsumed=true;
        if(typeof readStdin!=='function')throw new ArithmeticInputError('stdin capability denied');
        const data=readStdin();
        if(typeof data!=='string')throw new ArithmeticInputError('stdin host must return String');
        if(new TextEncoder().encode(data).length>65536)
          throw new ArithmeticInputError('Arithmetic input exceeds 64 KiB');
        return data;
      }
      case 'ArithEval':return safeArithmetic(expr(node.value,scope));
      case 'HttpServeState':{
        if(pureDepth>0||functionDepth>0)
          throw Error('⤊ persistent HTTP server effect denied in a pure function');
        if(typeof httpServeState!=='function')
          throw Error('⤊ persistent HTTP state capability denied: inject trusted httpServeState host');
        if(Array.isArray(httpEffects)||Array.isArray(sleepEffects)||Array.isArray(fileEffects))
          throw Error('⤊ persistent HTTP server cannot replay top-level async effects');
        if(httpServerRegistered)throw Error('⤊ only one server may be registered');
        const handler=expr(node.handler,scope),initial=expr(node.initial,scope);
        if(typeof handler!=='function'||typeof initial!=='string'||
           !initial.isWellFormed()||new TextEncoder().encode(initial).length>1048576)
          throw TypeError('⤊ stateful handler requires Function and bounded String initial state');
        httpServeState((...args)=>{pureDepth++;try{return handler(...args);}finally{pureDepth--;}},initial);
        httpServerRegistered=true;
        return null;
      }
      case 'HttpServe':{
        if(pureDepth>0 || functionDepth>0)
          throw Error('⤊ HTTP serve effect denied in pure package or handler function');
        if(typeof httpServe!=='function')
          throw Error('⤊ HTTP server capability denied: inject trusted httpServe host');
        if(Array.isArray(httpEffects)||Array.isArray(sleepEffects)||Array.isArray(fileEffects))
          throw Error('⤊ B1 cannot run through async replay; request-scoped effects require B2');
        if(httpServerRegistered)throw Error('⤊ only one server may be registered in B1');
        const handler=expr(node.value,scope);
        if(typeof handler!=='function')
          throw TypeError('⤊ requires a typed H-Code request-handler function');
        httpServe(handler);
        httpServerRegistered=true;
        return null;
      }
      case 'HttpGet':{
        if(pureDepth>0||functionDepth>0)throw Error('⤋ HTTP effect denied in verified pure package or sync closure');
        if(!Array.isArray(httpEffects))
          throw Error('⤋ requires asynchronous H-Code interpreter; synchronous execution cannot perform HTTP');
        const url=expr(node.value,scope);
        const batch=Array.isArray(url);
        if(batch){
          if(url.length>16||!url.every(x=>typeof x==='string'))
            throw TypeError('⤋ batch expects at most 16 String URLs');
        }else if(typeof url!=='string')throw TypeError('⤋ expects String URL');
        const index=httpIndex++;
        if(index<httpEffects.length){
          const previous=httpEffects[index];
          const same=batch?Array.isArray(previous.url)&&
            previous.url.length===url.length&&previous.url.every((u,i)=>u===url[i]):
            previous.url===url;
          if(!same)throw Error('Non-deterministic H-Code HTTP replay');
          return previous.value;
        }
        if(index!==httpEffects.length)throw Error('H-Code HTTP journal sequence gap');
        throw new PendingHttpEffect(batch?[...url]:url,index);
      }
      case 'Sleep':{
        if(pureDepth>0||functionDepth>0)throw Error('⌛ delay effect denied in pure package or sync closure');
        if(!Array.isArray(sleepEffects))
          throw Error('⌛ requires asynchronous H-Code interpreter; synchronous execution cannot wait');
        const ms=expr(node.value,scope);
        if(!Number.isSafeInteger(ms)||ms<0||ms>120000)
          throw RangeError('⌛ expects bounded nonnegative integer milliseconds');
        const index=sleepIndex++;
        if(index<sleepEffects.length){
          if(sleepEffects[index]!==ms)throw Error('Non-deterministic H-Code delay replay');
          return null;
        }
        if(index!==sleepEffects.length)throw Error('H-Code delay journal sequence gap');
        throw new PendingSleepEffect(ms,index);
      }
      case 'FileWrite':{
        if(pureDepth>0||functionDepth>0)throw Error('⧅ file write effect denied in pure package or sync closure');
        if(!Array.isArray(fileEffects))
          throw Error('⧅ requires asynchronous H-Code interpreter; synchronous execution cannot write files');
        // Evaluate operands once, in source order, without reissuing prior host
        // effects when this interpreter replays after a later await/sleep.
        const filename=expr(node.filename,scope),content=expr(node.content,scope);
        if(typeof filename!=='string')
          throw TypeError('⧅ filename must be String');
        if(typeof content!=='string')
          throw TypeError('⧅ content must be String');
        const nameOk=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(filename)&&
          !filename.endsWith('.')&&!/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(filename)&&
          filename!=='.'&&filename!=='..';
        if(!nameOk)throw TypeError('⧅ expects a portable single-component filename');
        if(!content.isWellFormed())
          throw TypeError('⧅ rejects unpaired Unicode surrogates');
        const byteLength=new TextEncoder().encode(content).byteLength;
        if(byteLength>65536)throw RangeError('⧅ output exceeds 64 KiB UTF-8');
        const index=fileIndex++;
        if(index<fileEffects.length){
          const previous=fileEffects[index];
          if(previous.filename!==filename||previous.content!==content)
            throw Error('Non-deterministic H-Code file-write replay');
          return previous.byteLength;
        }
        if(index!==fileEffects.length)throw Error('H-Code file-write journal sequence gap');
        throw new PendingFileWriteEffect(filename,content,index,byteLength);
      }
      case 'FileRead':{
        const path=expr(node.value,scope);
        if(typeof path!=='string')throw Error('⧄ requires String file name');
        if(typeof readFile!=='function')throw Error('H-Code file-read capability denied');
        const data=readFile(path);
        if(typeof data!=='string')throw Error('Host file-read must return UTF-8 String');
        return data;
      }
      case 'CsvTyped':{
        if(!node.schema.startsWith('⦃')||!node.schema.endsWith('⦄'))
          throw Error('⧇ requires typed record schema');
        const schema=recordAnnotationFields(node.schema);
        return decodeTypedCSV(expr(node.value,scope),schema);
      }
      case 'TextScalars':return textScalars(expr(node.value,scope));
      case 'TextWords':return textWords(expr(node.value,scope));
      case 'Markdown':return readMarkdownTokens(expr(node.value,scope));
      case 'Histogram':return histogram(expr(node.value,scope));
      case 'JsonRead':{
        verifyJsonSchema(node.schema);
        const text=expr(node.value,scope);
        if(typeof text!=='string')throw Error('⤓ expects JSON String');
        if(jsonBytes(text)>JSON_MAX_BYTES)throw Error('JSON input size exceeded');
        let value;try{value=JSON.parse(text);}catch{throw Error('Invalid JSON text');}
        return jsonReadCheck(value,node.schema);
      }
      case 'JsonValid':{
        verifyJsonSchema(node.schema);
        const text=expr(node.value,scope);
        if(typeof text!=='string')throw TypeError('⤔ requires String');
        if(jsonBytes(text)>JSON_MAX_BYTES||!text.isWellFormed())return false;
        let parsed;
        try{parsed=JSON.parse(text);}catch{return false;}
        try{jsonReadCheck(parsed,node.schema);return true;}
        catch(error){
          if(error?.message==='Execution step limit exceeded')throw error;
          return false;
        }
      }
      case 'JsonWrite':{
        const value=jsonWriteCheck(expr(node.value,scope));
        const text=JSON.stringify(value);
        if(jsonBytes(text)>JSON_MAX_BYTES)throw Error('JSON output size exceeded');
        return text;
      }
      case 'Literal':return node.value;
      case 'Record':{
        if(node.fields.length>64)throw Error('Record field limit exceeded');
        const value=Object.create(null);
        for(const field of node.fields){
          step();
          if(Object.hasOwn(value,field.name))throw Error('Duplicate record field '+field.name);
          value[field.name]=expr(field.value,scope);
        }
        return Object.freeze(value);
      }
      case 'RecordUpdate':{
        const original=expr(node.record,scope);
        if(original===null||typeof original!=='object'||Array.isArray(original)||
           Object.getPrototypeOf(original)!==null||!Object.hasOwn(original,node.name))
          throw Error('Unknown record field '+node.name);
        const updated=expr(node.value,scope);
        if(seqElementType(original[node.name])!==seqElementType(updated))
          throw Error('Record update field type mismatch');
        const copy=Object.assign(Object.create(null),original);
        copy[node.name]=updated;
        return Object.freeze(copy);
      }
      case 'Field':{
        const value=expr(node.record,scope);
        if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==null||
            !Object.hasOwn(value,node.name))throw Error('Unknown record field '+node.name);
        return value[node.name];
      }
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
          functionDepth++;
          try{return expr(node.body,closureScope);}finally{functionDepth--;}
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
  const concretize=(type,bindings)=>{
    if(!type)return type;
    if(type.startsWith('⟦')&&type.endsWith('⟧'))return '⟦'+concretize(type.slice(1,-1),bindings)+'⟧';
    if(type.startsWith('⦃')&&type.endsWith('⦄'))
      return '⦃'+recordAnnotationFields(type).map(([k,ty])=>k+':'+concretize(ty,bindings)).join(',')+'⦄';
    const resolved=bindings?.get(type);
    return resolved?typeToString(resolved):type;
  };
  function stmt(node,scope){
    step();
    switch(node.kind){
      case 'Use':break;
      case 'Let':{
        const annotation=concretize(node.annotation??null,scope.genericBindings);
        const val=expr(node.value,scope,annotation);
        requireType(val,annotation);
        scope.define(node.name,val,annotation);
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
          functionDepth++;
          try{
          step();
          if(args.length!==node.params.length)throw Error(`${node.name} expects ${node.params.length} arguments`);
          // A polymorphic source function is never executed as unchecked Any.
          // Instantiate its own declared ∀ signature with the actual inputs.
          const polymorphic=node.typeParameters?.length>0;
          const inferred=polymorphic?specializeCall({name:node.name,typeParameters:node.typeParameters,
            parameters:node.params.map(p=>({name:p.name,type:p.type})),returns:node.returnType},args,maxSequenceItems):null;
          const inner=new Scope(scope);
          inner.genericBindings=inferred?.bindings??new Map();
          inner.returnType=concretize(node.returnType,inner.genericBindings);
          for(let j=0;j<args.length;j++){
            const annotation=concretize(node.params[j].type,inner.genericBindings);
            requireType(args[j],annotation);
            inner.define(node.params[j].name,args[j],annotation);
          }
          try{for(const statement of node.body.body)stmt(statement,inner);}catch(e){if(e instanceof ReturnSignal){requireType(e.value,inner.returnType,'return');return e.value;}throw e;}
          return null;
          }finally{functionDepth--;}
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
      operationSpecs.set(id,operation);
      operations.set(id,(...args)=>{
        step();
        if(args.length!==operation.parameters.length)throw Error(`${id} expects ${operation.parameters.length} argument(s)`);
        const specialized=pkg.manifest.format===3?specializeCall(operation,args,maxSequenceItems):null;
        for(let j=0;j<args.length;j++){
          const actual=runtimeType(args[j]),expected=operation.parameters[j].type;
          if(pkg.manifest.format===3){
            // Arguments were freshly specialized against ∀T above.
          }else if(pkg.manifest.format===2){
            try{requireType(args[j],expected);}
            catch(e){throw Error(`${id}: argument ${j+1} (${operation.parameters[j].name}) expects ${expected}: ${e.message}`);}
          }else if(actual!==expected)throw Error(`${id}: argument ${j+1} (${operation.parameters[j].name}) expects ${expected}, got ${actual}`);
        }
        let result;
        // SHA-verified package code remains effect-free even during async replay.
        pureDepth++;
        try{result=implementation(...args);}finally{pureDepth--;}
        const actual=runtimeType(result);
        if(pkg.manifest.format===3){
          checkSpecializedReturn(result,specialized,maxSequenceItems);
        }else if(pkg.manifest.format===2){
          try{requireType(result,operation.returns,'return');}
          catch(e){throw Error(`${id}: return expects ${operation.returns}: ${e.message}`);}
        }else if(actual!==operation.returns)throw Error(`${id}: return expects ${operation.returns}, got ${actual}`);
        return result;
      });
    }
  }
  for(const statement of ast.body){
    // The application runtime must not bypass source verification by defining
    // universal functions outside an SHA-locked pure package.
    if(statement.kind==='Function'&&statement.typeParameters?.length)
      throw Error('∀ declarations require a verified pure package source');
    stmt(statement,root);
  }
  return {steps};
}

/**
 * Reference async effect runner. Only the host-supplied function performs I/O.
 * All H-Code control flow is evaluated by the independent JS interpreter, with
 * bounded deterministic replay and no unsafe eval/new Function.
 *
 * Async task 06 is not complete until a general async interpreter is added:
 * this replay strategy deliberately handles only top-level effectful programs.
 */
export async function executeAsync(source,options={}){
  const maxHttpRequests=options.maxHttpRequests??32;
  const maxFileWrites=options.maxFileWrites??32;
  const maxTotalFileBytes=options.maxTotalFileBytes??262144;
  if(!Number.isInteger(maxFileWrites)||maxFileWrites<1||maxFileWrites>64||
    !Number.isSafeInteger(maxTotalFileBytes)||maxTotalFileBytes<0||maxTotalFileBytes>4194304||
    (options.fileWrite!==undefined&&typeof options.fileWrite!=='function'))
    throw RangeError('Invalid ⧅ effect budget');
  const maxSleepEffects=options.maxSleepEffects??64;
  const maxTotalSleepMs=options.maxTotalSleepMs??120000;
  if(!Number.isInteger(maxSleepEffects)||maxSleepEffects<1||maxSleepEffects>64||
     !Number.isInteger(maxTotalSleepMs)||maxTotalSleepMs<0||maxTotalSleepMs>120000||
     (options.sleepMs!==undefined&&typeof options.sleepMs!=='function'))
    throw RangeError('Invalid bounded H-Code delay configuration');
  if(!Number.isInteger(maxHttpRequests)||maxHttpRequests<1||maxHttpRequests>64)
    throw RangeError('Invalid bounded H-Code HTTP request limit');
  const registry=options.registry??new Map();
  const program=linkProgram(parse(source),registry);
  const journal=[],sleepJournal=[],fileJournal=[];
  let totalFileBytes=0;
  let totalSleepMs=0,totalHttpRequests=0;
  let cachedStdin=false,stdinValue;
  const cachedFiles=new Map();
  const readStdin=typeof options.readStdin==='function'?()=>{
    if(!cachedStdin){stdinValue=options.readStdin();cachedStdin=true;}
    return stdinValue;
  }:null;
  const readFile=typeof options.readFile==='function'?name=>{
    if(!cachedFiles.has(name))cachedFiles.set(name,options.readFile(name));
    return cachedFiles.get(name);
  }:null;
  for(;;){
    const lines=[];
    try{
      const result=evaluate(program,{...options,registry,readStdin,readFile,httpEffects:journal,sleepEffects:sleepJournal,fileEffects:fileJournal,stdout:line=>lines.push(line)});
      for(const line of lines)options.stdout?.(line);
      return {...result,httpRequests:totalHttpRequests,sleeps:sleepJournal.length,totalSleepMs,fileWrites:fileJournal.length,totalFileBytes};
    }catch(error){
      if(error instanceof PendingFileWriteEffect){
        if(error.index!==fileJournal.length)
          throw Error('Out-of-order H-Code file-write effect');
        if(typeof options.fileWrite!=='function')
          throw Error('H-Code file-write capability denied: inject a trusted fileWrite host');
        if(fileJournal.length>=maxFileWrites||totalFileBytes+error.byteLength>maxTotalFileBytes)
          throw RangeError('⧅ effect budget exceeded');
        // The host MUST implement the atomic no-clobber effect. Commit to the
        // journal only AFTER its promise resolved with the exact byte count.
        const size=await options.fileWrite(error.filename,error.content);
        if(!Number.isSafeInteger(size)||size!==error.byteLength)
          throw Error('Invalid H-Code file-write byte count from host');
        fileJournal.push(Object.freeze({filename:error.filename,content:error.content,byteLength:size}));
        totalFileBytes+=size;
        continue;
      }
      if(error instanceof PendingSleepEffect){
        if(error.index!==sleepJournal.length)throw Error('Out-of-order H-Code delay effect');
        if(sleepJournal.length>=maxSleepEffects||totalSleepMs+error.ms>maxTotalSleepMs)
          throw Error('H-Code delay effect budget exceeded');
        if(options.sleepMs)await options.sleepMs(error.ms);
        else await new Promise(resolve=>setTimeout(resolve,error.ms));
        sleepJournal.push(error.ms);totalSleepMs+=error.ms;
        continue;
      }
      if(!(error instanceof PendingHttpEffect))throw error;
      if(typeof options.httpGet!=='function')
        throw Error('H-Code HTTP capability denied: inject a trusted httpGet host');
      if(error.index!==journal.length)throw Error('Out-of-order H-Code HTTP effect');
      const batch=Array.isArray(error.url),urls=batch?error.url:[error.url];
      if(urls.length>16||!urls.every(u=>typeof u==='string'))
        throw TypeError('⤋ batch expects at most 16 String URLs');
      if(journal.length>=maxHttpRequests||totalHttpRequests+urls.length>maxHttpRequests)
        throw Error('H-Code HTTP effect budget exceeded');
      // Validate ALL URLs before allowing any host I/O.
      for(const raw of urls){
        let url;
        try{url=new URL(raw);}catch{throw TypeError('H-Code HTTP URL is invalid');}
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password)
          throw TypeError('H-Code HTTP(S) URL required without embedded credentials');
      }
      // Every host call must start before any result is awaited. This is true
      // concurrency; the interpreter does not serialize effect journal entries.
      const answers=await Promise.all(urls.map(async u=>{
        try{return await options.httpGet(u);}
        catch{return {status:0,ok:false,body:'',retryAfter:0};}
      }));
      const normalize=answer=>{
        // Normalize and freeze the host boundary; no arbitrary fields,
        // prototypes, functions or unbounded response bodies.
        if(answer===null||typeof answer!=='object'||Array.isArray(answer)||
           Object.keys(answer).sort().join(',')!=='body,ok,retryAfter,status'||
           !Number.isInteger(answer.status)||
           !(answer.status===0||answer.status>=200&&answer.status<=599)||
           typeof answer.ok!=='boolean'||typeof answer.body!=='string'||
           !Number.isInteger(answer.retryAfter)||answer.retryAfter<0||answer.retryAfter>120000||
           (answer.status===0&&(answer.ok||answer.body!==''))||
           (answer.status!==0&&answer.ok!==(answer.status>=200&&answer.status<300))||
           new TextEncoder().encode(answer.body).byteLength>65536)
          throw TypeError('Invalid H-Code HTTP response from host');
        return Object.freeze(Object.assign(Object.create(null),{
          body:answer.body,ok:answer.ok,retryAfter:answer.retryAfter,status:answer.status
        }));
      };
      const values=answers.map(normalize);
      const value=batch?Object.freeze(values):values[0];
      journal.push({url:batch?Object.freeze([...urls]):urls[0],value});
      totalHttpRequests+=urls.length;
    }
  }
}

export function execute(source,options={}){
  const registry=options.registry??new Map();
  return evaluate(linkProgram(parse(source),registry),{...options,registry});
}
