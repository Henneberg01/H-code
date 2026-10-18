ƒ fac(n: Number) → Number {
  if (n ≤ 1) { ↩ 1; }
  ↩ n * fac(n - 1);
}
print(fac(5));
