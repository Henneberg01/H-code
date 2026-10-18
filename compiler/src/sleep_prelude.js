// General-purpose intrinsic ⌛ bounded asynchronous delay, not an HTTP retry policy.
let __hc_sleep_count=0,__hc_sleep_total=0;
const __hc_sleep=async ms=>{
  __hc_tick();
  if(!Number.isSafeInteger(ms)||ms<0||ms>120000)
    throw RangeError('⌛ expects bounded nonnegative integer milliseconds');
  if(++__hc_sleep_count>64||(__hc_sleep_total+=ms)>120000)
    throw Error('H-Code delay effect budget exceeded');
  await new Promise(resolve=>setTimeout(resolve,ms));
  return null;
};
