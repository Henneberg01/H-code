// Pure, bounded H-Code Markdown structural token library.
// Sign maps String -> sequence of {href,kind,level,text} structural records.
// Supported: ATX and Setext headings, inline links, URL autolinks,
// escapes, code spans, fenced/indented code. A documented extraction subset,
// NOT full CommonMark. No filesystem, eval, network or fixture-specific paths.
const __hc_md_tokens = source => {
  if (typeof source !== 'string') throw TypeError('Markdown expects String input');
  if (!source.isWellFormed()) throw TypeError('Markdown invalid Unicode surrogate');
  if (new TextEncoder().encode(source).length > 1048576) throw RangeError('Markdown input exceeds 1 MiB');
  const lines = source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  if (lines.length > 8192) throw RangeError('Markdown exceeds 8192 lines');
  const found = [];
  const unescapeMd = value => value.replace(/\\([\\\x60*_{}\[\]()#+\-.!<>])/g,'$1');
  const push = (kind,level,text,href='') => {
    if (found.length >= 4096) throw RangeError('Markdown token limit exceeded');
    __hc_tick();
    found.push(__hc_record([['href',href],['kind',kind],['level',level],['text',text]]));
  };
  const readLink = (line,open) => {
    let j=open+1,brackets=1;
    for (;j<line.length;j++){
      if (line[j]==='\\'){j++;continue;}
      if (line[j]==='[')brackets++;
      if (line[j]===']'&&--brackets===0)break;
    }
    if (brackets!==0||line[j+1]!=='(')return null;
    let cursor=j+2,depth=1,destination='';
    for (;cursor<line.length;cursor++){
      const char=line[cursor];
      if (char==='\\' && cursor+1<line.length){destination+=line[++cursor];continue;}
      if (char==='('){depth++;destination+=char;continue;}
      if (char===')'){
        if (--depth===0)break;
        destination+=char;continue;
      }
      destination+=char;
    }
    if (depth!==0)return null;
    let href=destination.trim();
    if (href.startsWith('<')&&href.endsWith('>')&&href.length>=2)
      href=href.slice(1,-1);
    else if (/\s/.test(href))return null;
    if (href.length>8192)return null;
    return {end:cursor+1,text:unescapeMd(line.slice(open+1,j)),href};
  };
  const inline = line => {
    let i=0;
    while(i<line.length){
      const c=line[i];
      if (c==='\\'){i+=2;continue;}
      if (c==='\x60'){
        let n=1;while(line[i+n]==='\x60')n++;
        const marker='\x60'.repeat(n),start=i+n;
        let end=line.indexOf(marker,start);
        while(end>=0 && (line[end+n]==='\x60'||line[end-1]==='\x60'))end=line.indexOf(marker,end+n);
        if (end>=0){i=end+n;continue;}
        i+=n;continue;
      }
      if (c==='!'&&line[i+1]==='['){
        const image=readLink(line,i+1);
        if(image){i=image.end;continue;}
      }
      if (c==='['){
        const link=readLink(line,i);
        if(link){push('link',0,link.text,link.href);i=link.end;continue;}
      }
      if(c==='<'){
        const match=/^<(https?:\/\/[^\s<>]+)>/i.exec(line.slice(i));
        if(match){push('link',0,match[1],match[1]);i+=match[0].length;continue;}
      }
      i++;
    }
  };
  let fence=null,pending=null;
  const flush = () => {if(pending!==null){inline(pending);pending=null;}};
  for(let raw of lines){
    __hc_tick();
    if (raw.length>16384) throw RangeError('Markdown line exceeds 16384 units');
    raw=raw.replace(/^ {0,3}>\s?/,'');
    const opening=/^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(raw);
    if(fence){
      const close=new RegExp('^ {0,3}'+(fence.kind==='\x60'?'\\x60':'~')+'{'+fence.count+',}[ \\t]*$');
      if(close.test(raw))fence=null;
      continue;
    }
    if(opening){
      flush();
      fence={kind:opening[1][0],count:opening[1].length};
      continue;
    }
    if(/^ {4}|^\t/.test(raw)){flush();continue;}
    const atx=/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(raw);
    if(atx){
      flush();
      const title=atx[2].replace(/[ \t]+#+[ \t]*$/,'').trim();
      push('heading',atx[1].length,unescapeMd(title));
      inline(title);continue;
    }
    const underline=/^ {0,3}(=+|-+)[ \t]*$/.exec(raw);
    if(underline&&pending!==null){
      const title=pending.trim();
      pending=null;
      push('heading',underline[1][0]==='='?1:2,unescapeMd(title));
      inline(title);continue;
    }
    if(raw.trim()===''){flush();continue;}
    if(/^ {0,3}\[[^\]]+\]:\s*\S/.test(raw)){flush();continue;}
    flush();
    pending=raw;
  }
  flush();
  return __hc_seq(found);
};
