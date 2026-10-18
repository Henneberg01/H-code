fn fac(n: Number) -> Number {
  if (n <= 1) { return 1; }
  return n * fac(n - 1);
}
print(fac(5));
