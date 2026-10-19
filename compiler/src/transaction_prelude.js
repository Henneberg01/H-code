let __hc_tx_store,__hc_tx_active=false,__hc_tx_calls=0;
const __hc_transaction=(handler,initial)=>{
  __hc_tick();
  if(__hc_cas_reducer_active)throw Error('transaction effect denied in pure evaluation');
  if(__hc_tx_active)throw Error('nested transaction denied');
  if(++__hc_tx_calls>64)throw Error('transaction budget exceeded');
  if(!__hc_tx_store)__hc_tx_store=createStringTransactionStore({root:process.env.HCODE_TX_STATE_ROOT});
  __hc_tx_active=true;
  try{return __hc_tx_store.transact(handler,initial);}
  finally{__hc_tx_active=false;}
};
process.once('exit',()=>__hc_tx_store?.close());
