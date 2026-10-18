ƒ transform(raw:String)→String {
  ≔d←⤓⦃user:⦃name:String,score:Number,active:Bool⦄,events:⟦⦃id:String,value:Number⦄⟧⦄raw;
  ≔u←d·user;
  ≔v←u⊞score:u·score+3;
  ≔w←v⊞active:¬u·active;
  ≔r←d⊞user:w;
  ↩ ⤒r;
}
/* CANONICAL05_CALLS */
print(transform("{\"user\":{\"name\":\"Ada\",\"score\":7,\"active\":true},\"events\":[{\"id\":\"A\",\"value\":4},{\"id\":\"B\",\"value\":-3}]}"));
print(transform("{\"events\":[{\"value\":0,\"id\":\"Ø\"}],\"user\":{\"active\":false,\"score\":-2,\"name\":\"Zoë\"}}"));
print(transform("{\"user\":{\"name\":\"Li\",\"score\":0,\"active\":true},\"events\":[]}"));
