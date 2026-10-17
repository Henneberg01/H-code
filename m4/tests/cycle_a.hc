import "./cycle_b.hc" as b;
export fn a(n: Number) -> Number { return b::b(n); }
