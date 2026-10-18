// A general bounded arithmetic expression evaluator, not an app-specific
// calculator shortcut and never JavaScript eval(). Numeric grammar supports
// finite decimal/exponent numbers, unary +/- and precedence + - * / ( ).
const __hc_arith = input => {
  __hc_tick();
  if(typeof input!=='string')throw Error('Arithmetic expression requires String');
  if(new TextEncoder().encode(input).length>65536)
    throw Error('Arithmetic input exceeds 64 KiB');
  let i=0,depth=0,steps=0;
  const bad=()=>{throw Error('Invalid arithmetic expression');};
  const tick=()=>{__hc_tick();if(++steps>100000)throw Error('Arithmetic complexity limit exceeded');};
  const skip=()=>{while(i<input.length&&/\s/u.test(input[i])){i++;tick();}};
  const finite=value=>{
    if(!Number.isFinite(value))throw Error('Numeric overflow');
    return value;
  };
  const number=()=>{
    tick();skip();
    const m=/^(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input.slice(i));
    if(!m)bad();
    i+=m[0].length;
    return finite(Number(m[0]));
  };
  const atom=()=>{
    tick();skip();
    if(input[i]==='('){
      i++;const result=sum();skip();
      if(input[i]!==')')bad();
      i++;return result;
    }
    return number();
  };
  const unary=()=>{
    tick();if(++depth>128)throw Error('Arithmetic nesting limit exceeded');
    try{
      skip();
      if(input[i]==='+'||input[i]==='-'){
        const negative=input[i++]==='-';
        const v=unary();
        return finite(negative?-v:v);
      }
      return atom();
    }finally{depth--;}
  };
  const product=()=>{
    let left=unary();
    while(true){
      tick();skip();
      const op=input[i];
      if(op!=='*'&&op!=='/')break;
      i++;const right=unary();
      if(op==='/'&&right===0)throw Error('Division by zero');
      left=finite(op==='*'?left*right:left/right);
    }
    return left;
  };
  const sum=()=>{
    let left=product();
    while(true){
      tick();skip();
      const op=input[i];
      if(op!=='+'&&op!=='-')break;
      i++;const right=product();
      left=finite(op==='+'?left+right:left-right);
    }
    return left;
  };
  const result=sum();skip();
  if(i!==input.length)bad();
  return result;
};
