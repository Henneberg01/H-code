// Pure H-Code functions. The package manifest exposes these through typed symbols.
fn add(a: Number, b: Number) -> Number {
  return a + b;
}

fn repeat2(value: String) -> String {
  return value + value;
}

fn is_positive(value: Number) -> Bool {
  return value > 0;
}

fn factorial(n: Number) -> Number {
  if (n <= 1) { return 1; }
  return n * factorial(n - 1);
}
