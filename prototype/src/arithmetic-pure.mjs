// Independent JS-reference implementation: tokenize then precedence-climb.
// Rust-generated JS uses a separate recursive-descent runtime module.
export class ArithmeticInputError extends Error {
  constructor(message){super(message);this.name='ArithmeticInputError';this.code='HCODE_CLI';}
}
const fail=message=>{throw new ArithmeticInputError(message)};
const finite=x=>{if(!Number.isFinite(x))fail('Numeric overflow');return x};
export function safeArithmetic(input){
  if(typeof input!=='string')fail('Arithmetic expression requires String');
  if(new TextEncoder().encode(input).length>65536)fail('Arithmetic input exceeds 64 KiB');
  const tokens=[];
  for(let i=0;i<input.length;){
    const c=input[i];
    if(/\s/u.test(c)){i++;continue;}
    if('+-*/()'.includes(c)){tokens.push({type:c});i++;continue;}
    const m=/^(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input.slice(i));
    if(!m)fail('Invalid arithmetic expression');
    tokens.push({type:'number',value:finite(Number(m[0]))});i+=m[0].length;
    if(tokens.length>100000)fail('Arithmetic complexity limit exceeded');
  }
  let at=0,depth=0,steps=0;
  const peek=()=>tokens[at]?.type;
  const bump=()=>{if(++steps>100000)fail('Arithmetic complexity limit exceeded');};
  function atom(){
    bump();
    if(++depth>128)fail('Arithmetic nesting limit exceeded');
    try{
      if(peek()==='+'||peek()==='-'){
        const minus=peek()==='-';at++;
        const v=atom();
        return finite(minus?-v:v);
      }
      if(peek()==='('){
        at++;
        const v=expression(0);
        if(peek()!==')')fail('Invalid arithmetic expression');
        at++;return v;
      }
      if(peek()!=='number')fail('Invalid arithmetic expression');
      return tokens[at++].value;
    }finally{depth--;}
  }
  function expression(minimum){
    let left=atom();
    while(true){
      bump();
      const op=peek(),precedence=op==='*'||op==='/'?2:op==='+'||op==='-'?1:0;
      if(!precedence||precedence<minimum)break;
      at++;
      const right=expression(precedence+1);
      if(op==='/'&&right===0)fail('Division by zero');
      left=finite(op==='+'?left+right:op==='-'?left-right:op==='*'?left*right:left/right);
    }
    return left;
  }
  const answer=expression(0);
  if(at!==tokens.length)fail('Invalid arithmetic expression');
  return answer;
}
