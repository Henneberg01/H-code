import "./cycle_a.hc" as a;
export fn b(n: Number) -> Number { return a::a(n); }
