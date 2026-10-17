export fn grow(balance: Number, rate_percent: Number) -> Number {
  return balance + balance * rate_percent / 100;
}
export fn reachable(balance: Number, target: Number) -> Bool { return balance >= target; }
