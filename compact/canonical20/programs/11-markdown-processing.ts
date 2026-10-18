// Independent H-Code canonical11 TypeScript correctness oracle.
// This extracts Markdown heading and link tokens; not a full CommonMark AST,
// and not a competitively selected idiomatic TypeScript baseline.
import {readFileSync} from 'node:fs';

type Row={href:string,kind:string,level:number,text:string};
function extractMarkdown(doc:string):Row[]{
 if(typeof doc!=='string'||!doc.isWellFormed())throw TypeError('Markdown expects valid Unicode String');
 if(new TextEncoder().encode(doc).length>1048576)throw RangeError('Markdown input exceeds 1 MiB');
 const lines=doc.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 if(lines.length>8192)throw RangeError('Markdown exceeds 8192 lines');
 const result:Row[]=[];
 function emit(kind:string,level:number,text:string,href:string=''){
   if(result.length>=4096)throw RangeError('Markdown token limit exceeded');
   result.push({href,kind,level,text});
 }
 const plain=(text:string)=>text.replace(/\\([\\\x60*_{}\[\]()#+\-.!<>])/g,'$1');
 const scan=(content:string)=>{
   let i=0;
   while(i<content.length){
    if(content[i]==='\\'){i+=2;continue;}
    if(content[i]==='\x60'){
     let width=1;while(content[i+width]==='\x60')width++;
     const separator='\x60'.repeat(width);
     let q=content.indexOf(separator,i+width);
     while(q>=0&&(content[q-1]==='\x60'||content[q+width]==='\x60'))
       q=content.indexOf(separator,q+width);
     i=q<0?i+width:q+width;continue;
    }
    if(content[i]==='['||(content[i]==='!'&&content[i+1]==='[')){
      const image=content[i]==='!';
      const start=i+(image?1:0);
      let k=start+1,brackets=1;
      while(k<content.length&&brackets){
       if(content[k]==='\\'){k+=2;continue;}
       if(content[k]==='[')brackets++;
       if(content[k]===']')brackets--;
       k++;
      }
      if(brackets===0&&content[k]==='('){
       let p=k+1,depth=1,href='';
       while(p<content.length&&depth){
        const c=content[p++];
        if(c==='\\'&&p<content.length){href+=content[p++];continue;}
        if(c==='('){depth++;href+=c;}
        else if(c===')'){if(--depth)href+=c;}
        else href+=c;
       }
       if(depth===0){
        href=href.trim();
        if(href.length>=2&&href[0]==='<'&&href.at(-1)==='>')href=href.slice(1,-1);
        else if(/\s/.test(href)){i++;continue;}
        if(href.length>8192){i++;continue;}
        if(!image)emit('link',0,plain(content.slice(start+1,k-1)),href);
        i=p;continue;
       }
      }
    }
    if(content[i]==='<'){
      const e=content.indexOf('>',i+1);
      if(e>=0){
       const link=content.slice(i+1,e);
       if(/^https?:\/\/[^\s<>]+$/i.test(link)){
        emit('link',0,link,link);i=e+1;continue;
       }
      }
    }
    i++;
   }
 };
 let pending:string|null=null;
 let fence:string|null=null;
 let minFence=0;
 const flush=()=>{if(pending!==null){scan(pending);pending=null;}};
 for(let raw of lines){
   if(raw.length>16384)throw RangeError('Markdown line exceeds 16384 units');
   raw=raw.replace(/^ {0,3}>[ \t]?/,'');
   if(fence!==null){
     const close=new RegExp('^ {0,3}'+(fence==='\x60'?'\\x60':'~')+'{'+minFence+',}[ \\t]*$');
     if(close.test(raw))fence=null;
     continue;
   }
   const opener=/^ {0,3}(\x60{3,}|~{3,})/.exec(raw);
   if(opener){flush();fence=opener[1][0];minFence=opener[1].length;continue;}
   if(raw.startsWith('    ')||raw.startsWith('\t')){flush();continue;}
   const atx=/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(raw);
   if(atx){
     flush();
     const label=atx[2].replace(/[ \t]+#+[ \t]*$/,'').trim();
     emit('heading',atx[1].length,plain(label));scan(label);continue;
   }
   const setext=/^ {0,3}(=+|-+)[ \t]*$/.exec(raw);
   if(setext&&pending!==null){
     const label=pending.trim();pending=null;
     emit('heading',setext[1][0]==='='?1:2,plain(label));scan(label);continue;
   }
   if(!raw.trim()){flush();continue;}
   if(/^ {0,3}\[[^\]]+\]:\s*\S/.test(raw)){flush();continue;}
   flush();pending=raw;
 }
 flush();return result;
}
const data=new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(0));
console.log(JSON.stringify(extractMarkdown(data)));
