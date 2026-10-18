// Idiomatic independent TypeScript reference for canonical 06, NOT H-Code.
// Developer-authored source is measured in full, with fetch built into Node 22.
export type Attempt = {
  attempt: number;
  status: number | null;
  decision: 'success' | 'retry' | 'http-error' | 'exhausted' | 'network-retry' | 'network-exhausted';
  waitMs: number;
};
export type RetryResult = {
  ok: boolean;
  status: number | null;
  body: string;
  reason: 'http' | 'exhausted' | 'network' | null;
  trace: Attempt[];
};
export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  transport?: typeof fetch;
};
const RETRYABLE = new Set([429,500,502,503,504]);
const realSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function fetchWithRetries(url: string, options: RetryOptions = {}): Promise<RetryResult> {
  const {maxAttempts=4,baseDelayMs=100,maxBackoffMs=1000,timeoutMs=2000,
    sleep=realSleep,transport=fetch} = options;
  if (!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>8||
      !Number.isInteger(baseDelayMs)||baseDelayMs<0||baseDelayMs>60000||
      !Number.isInteger(maxBackoffMs)||maxBackoffMs<baseDelayMs||maxBackoffMs>120000||
      !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000) {
    throw new RangeError('Invalid bounded retry configuration');
  }
  const parsed = new URL(url);
  if (!['http:','https:'].includes(parsed.protocol)) throw new TypeError('HTTP(S) URL required');
  const trace: Attempt[] = [];
  for (let attempt=1;attempt<=maxAttempts;attempt++) {
    const backoff = Math.min(maxBackoffMs, baseDelayMs * 2**(attempt-1));
    let response: Response;
    try {
      response = await transport(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
    } catch {
      const exhausted=attempt===maxAttempts;
      trace.push({attempt,status:null,decision:exhausted?'network-exhausted':'network-retry',waitMs:exhausted?0:backoff});
      if(exhausted)return {ok:false,status:null,body:'',reason:'network',trace};
      await sleep(backoff);continue;
    }
    const body = await response.text();
    if(response.ok){
      trace.push({attempt,status:response.status,decision:'success',waitMs:0});
      return {ok:true,status:response.status,body,reason:null,trace};
    }
    const canRetry = RETRYABLE.has(response.status);
    if (!canRetry||attempt===maxAttempts){
      trace.push({attempt,status:response.status,decision:canRetry?'exhausted':'http-error',waitMs:0});
      return {ok:false,status:response.status,body,reason:canRetry?'exhausted':'http',trace};
    }
    const retryAfter = response.headers.get('retry-after');
    const seconds = retryAfter!==null && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
    const waitMs = Math.min(maxBackoffMs,Math.max(backoff,Number.isSafeInteger(seconds)&&seconds<=120?seconds*1000:0));
    trace.push({attempt,status:response.status,decision:'retry',waitMs});
    await sleep(waitMs);
  }
  throw Error('Unreachable retry state');
}
