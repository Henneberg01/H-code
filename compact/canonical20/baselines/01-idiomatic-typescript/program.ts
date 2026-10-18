import {readFileSync} from "node:fs";
import {Parser} from "@expr-eval/js";

const parser=new Parser({allowMemberAccess:false,operators:{
  add:true,subtract:true,multiply:true,divide:true,
  conditional:false,comparison:false,logical:false,
  power:false,remainder:false,factorial:false,
  concatenate:false,assignment:false,in:false
}});
const invalid=():never=>{throw Error("Invalid arithmetic expression");};
const finite=(n:number)=>{if(!Number.isFinite(n))throw Error("Numeric overflow");return n;};
parser.binaryOps={
  ...parser.binaryOps,
  "+":(a,b)=>finite(a+b),
  "-":(a,b)=>finite(a-b),
  "*":(a,b)=>finite(a*b),
  "/":(a,b)=>{if(b===0)throw Error("Division by zero");return finite(a/b);}
};

export function arithmetic(input:string):number{
  if(new TextEncoder().encode(input).length>65536)throw Error("Arithmetic input exceeds 64 KiB");
  // Restrict the maintained library to the exact original calculator grammar.
  // Reject names, properties, calls, implicit multiplication and other operators.
  const token=/\s+|(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/]/gu;
  let i=0,expectValue=true,depth=0,unary=0,steps=0;
  while(i<input.length){
    token.lastIndex=i;const match=token.exec(input);
    if(!match||match.index!==i)invalid();
    const t=match[0];i=token.lastIndex;
    if(++steps>100000)throw Error("Arithmetic complexity limit exceeded");
    if(/^\s+$/u.test(t))continue;
    if(t==="("){
      if(!expectValue)invalid();
      if(++depth>128)throw Error("Arithmetic nesting limit exceeded");
    }else if(t===")"){
      if(expectValue||depth===0)invalid();
      depth--;expectValue=false;unary=0;
    }else if(t==="+"||t==="-"){
      if(expectValue){
        if(++unary>128)throw Error("Arithmetic nesting limit exceeded");
      }else{expectValue=true;unary=0;}
    }else if(t==="*"||t==="/"){
      if(expectValue)invalid();
      expectValue=true;unary=0;
    }else{
      if(!expectValue)invalid();
      finite(Number(t));expectValue=false;unary=0;
    }
  }
  if(expectValue||depth!==0)invalid();
  try{
    const result=parser.parse(input).evaluate(Object.create(null));
    if(typeof result!=="number")invalid();
    return finite(result)===0?0:result;
  }catch(err){
    if(err instanceof Error && ["Division by zero","Numeric overflow"].includes(err.message))throw err;
    invalid();
  }
}

try{
  const bytes=readFileSync(0);
  if(bytes.length>65536)throw Error("Arithmetic input exceeds 64 KiB");
  let source:string;
  try{source=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}
  catch{throw Error("Invalid UTF-8");}
  console.log(arithmetic(source));
}catch(err){
  const message=err instanceof Error?err.message:"Invalid arithmetic expression";
  console.error("HCODE_ERROR: "+message);
  process.exitCode=2;
}
