import {readFileSync} from "node:fs";
function evaluate(input:string):number {
  if(new TextEncoder().encode(input).length>65536)
    throw Error("Arithmetic input exceeds 64 KiB");
  let i=0,depth=0,steps=0;
  const invalid=():never=>{throw Error("Invalid arithmetic expression");};
  const tick=()=>{if(++steps>100000)throw Error("Arithmetic complexity limit exceeded");};
  const space=()=>{while(i<input.length&&/\s/u.test(input[i])){i++;tick();}};
  const finite=(n:number)=>{if(!Number.isFinite(n))throw Error("Numeric overflow");return n;};
  const literal=():number=>{
    tick();space();
    const m=/^(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input.slice(i));
    if(!m)return invalid();
    i+=m[0].length;
    return finite(Number(m[0]));
  };
  const atom=():number=>{
    tick();space();
    if(input[i]==="("){i++;const v=expression();space();if(input[i]!==")")invalid();i++;return v;}
    return literal();
  };
  const unary=():number=>{
    tick();if(++depth>128)throw Error("Arithmetic nesting limit exceeded");
    try{
      space();
      if(input[i]==="+"||input[i]==="-"){
        const negate=input[i++]==="-";
        const result=unary();
        return finite(negate?-result:result);
      }
      return atom();
    }finally{depth--;}
  };
  const term=():number=>{
    let result=unary();
    while(true){
      tick();space();const op=input[i];
      if(op!=="*"&&op!=="/")break;
      i++;const other=unary();
      if(op==="/"&&other===0)throw Error("Division by zero");
      result=finite(op==="*"?result*other:result/other);
    }
    return result;
  };
  const expression=():number=>{
    let result=term();
    while(true){
      tick();space();const op=input[i];
      if(op!=="+"&&op!=="-")break;
      i++;const other=term();
      result=finite(op==="+"?result+other:result-other);
    }
    return result;
  };
  const answer=expression();space();
  if(i!==input.length)invalid();
  return answer;
}
try{
  const bytes=readFileSync(0);
  if(bytes.length>65536)throw Error("Arithmetic input exceeds 64 KiB");
  const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  console.log(evaluate(text));
}catch(error){
  const message=error instanceof Error?error.message:String(error);
  console.error("HCODE_ERROR: "+(message.includes("encoded data")?"Invalid UTF-8":message));
  process.exitCode=2;
}
