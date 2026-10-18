const compareScalars=(a:string,b:string):number=>{
  const x=Array.from(a),y=Array.from(b);
  for(let i=0;i<Math.min(x.length,y.length);i++){
    const d=x[i].codePointAt(0)!-y[i].codePointAt(0)!;
    if(d!==0)return d;
  }
  return x.length-y.length;
};
function frequency(input:string):string{
  if(new TextEncoder().encode(input).length>1048576)throw Error("Text exceeds 1 MiB");
  const text=input.normalize("NFC").toLowerCase().normalize("NFC");
  if(new TextEncoder().encode(text).length>1048576)throw Error("Normalized text exceeds 1 MiB");
  const words=text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}\p{Pc}]*/gu)||[];
  if(words.length>16384)throw Error("Sequence size exceeded");
  const counts=new Map<string,number>();
  let bytes=0;
  for(const word of words){
    bytes+=new TextEncoder().encode(word).length;
    if(bytes>1048576)throw Error("Histogram text exceeds 1 MiB");
    counts.set(word,(counts.get(word)||0)+1);
  }
  const rows=Array.from(counts,([value,count])=>({count,value}));
  rows.sort((a,b)=>compareScalars(a.value,b.value));
  return JSON.stringify(rows);
}
console.log(frequency("Red RED blue red BLUE"));
console.log(frequency("CAFÉ café café café."));
console.log(frequency("東京 東京 世界 世界 עולם"));
console.log(frequency("🦊 fox 🦊 FOX 🐶 hĕllo"));
console.log(frequency("123 123 ٤٥٦ ٤٥٦ Ⅱ"));
console.log(frequency("can't can't hi_hi @HI_HI co-op"));
console.log(frequency(""));
console.log(frequency("z Z A a ä Ä ø Ø"));
console.log(frequency("alpha\tBETA\nalpha  beta"));
console.log(frequency("İ i I ı Σ σ ς"));
