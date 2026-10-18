// M19.06-B2: general-purpose bounded, asynchronous delay.
const __hc_sleep=async ms=>{
  __hc_tick();
  if(!Number.isInteger(ms)||ms<0||ms>120000)
    throw RangeError('⏳ delay requires integer milliseconds in 0..120000');
  // Explicit test-only virtual time; production scheduling is always real.
  if(process.env.HCODE_TEST_VIRTUAL_SLEEP==='1')return null;
  await new Promise(resolve=>setTimeout(resolve,ms));
  return null;
};
