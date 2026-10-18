// Independent H-Code M19.11 JavaScript correctness reference.
// Structural heading/link extraction: ATX, Setext, inline/autolinks, escapes,
// code spans, fences, indented code and blockquote heading syntax. This does
// not claim to be full CommonMark and does not execute or fetch any URL.
const unescape = value => value.replace(/\\([\\\x60*_{}\[\]()#+\-.!<>])/g,'$1');
export function readMarkdownTokens(input){
  if(typeof input!=='string')throw TypeError('Markdown expects String input');
  if(!input.isWellFormed())throw TypeError('Markdown invalid Unicode surrogate');
  if(Buffer.byteLength(input,'utf8')>1048576)throw RangeError('Markdown input exceeds 1 MiB');
  const lines=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  if(lines.length>8192)throw RangeError('Markdown exceeds 8192 lines');
  const tokens=[];
  function append(kind,level,text,href=''){
    if(tokens.length===4096)throw RangeError('Markdown token limit exceeded');
    tokens.push(Object.freeze(Object.assign(Object.create(null),{href,kind,level,text})));
  }
  function parseLink(line,start){
    let depth=1,close=start+1;
    while(depth && close<line.length){
      const c=line[close];
      if(c==='\\'){close+=2;continue;}
      if(c==='[')depth++;
      else if(c===']')depth--;
      close++;
    }
    if(depth||line[close]!=='(')return;
    let pos=close+1,paren=1,href='';
    while(paren && pos<line.length){
      const c=line[pos++];
      if(c==='\\'&&pos<line.length){href+=line[pos++];continue;}
      if(c==='('){paren++;href+=c;}
      else if(c===')'){if(--paren)href+=c;}
      else href+=c;
    }
    if(paren)return;
    href=href.trim();
    if(href[0]==='<'&&href.at(-1)==='>'&&href.length>=2)href=href.slice(1,-1);
    else if(/\s/.test(href))return;
    if(href.length>8192)return;
    return {href,text:unescape(line.slice(start+1,close-1)),end:pos};
  }
  function scan(text){
    for(let p=0;p<text.length;){
      const c=text[p];
      if(c==='\\'){p+=2;continue;}
      if(c==='\x60'){
        let q=p;while(text[q]==='\x60')q++;
        const n=q-p;let finish=-1;
        for(let j=q;j<text.length;){
          if(text[j]!=='\x60'){j++;continue;}
          let k=j;while(text[k]==='\x60')k++;
          if(k-j===n){finish=k;break;}
          j=k;
        }
        p=finish<0?q:finish;continue;
      }
      if(c==='!'&&text[p+1]==='['){
        const image=parseLink(text,p+1);
        if(image){p=image.end;continue;}
      }
      if(c==='['){
        const item=parseLink(text,p);
        if(item){append('link',0,item.text,item.href);p=item.end;continue;}
      }
      if(c==='<'){
        const end=text.indexOf('>',p+1);
        if(end>=0){
          const destination=text.slice(p+1,end);
          if(/^https?:\/\/[^\s<>]+$/i.test(destination)){
            append('link',0,destination,destination);
            p=end+1;continue;
          }
        }
      }
      p++;
    }
  }
  let current=null,inside=null;
  const flush=()=>{if(current!==null){scan(current);current=null;}};
  for(let original of lines){
    if(original.length>16384)throw RangeError('Markdown line exceeds 16384 units');
    original=original.replace(/^ {0,3}>[ \t]?/,'');
    const run=/^ {0,3}(\x60{3,}|~{3,})/.exec(original);
    if(inside){
      const closing=new RegExp('^ {0,3}'+(inside.ch==='\x60'?'\\x60':'~')+'{'+inside.n+',}[ \\t]*$');
      if(closing.test(original))inside=null;
      continue;
    }
    if(run){
      flush();inside={ch:run[1][0],n:run[1].length};continue;
    }
    if(original[0]==='\t'||original.startsWith('    ')){flush();continue;}
    const h=/^ {0,3}(#{1,6})([ \t]+|$)/.exec(original);
    if(h){
      flush();
      const text=original.slice(h[0].length).replace(/[ \t]+#+[ \t]*$/,'').trim();
      append('heading',h[1].length,unescape(text));scan(text);continue;
    }
    const underline=/^ {0,3}(=+|-+)[ \t]*$/.exec(original);
    if(underline&&current!==null){
      const title=current.trim();current=null;
      append('heading',underline[1][0]==='='?1:2,unescape(title));scan(title);continue;
    }
    if(!original.trim()){flush();continue;}
    if(/^ {0,3}\[[^\]]+\]:\s*\S/.test(original)){flush();continue;}
    flush();current=original;
  }
  flush();
  return Object.freeze(tokens);
}
