export fn reorder_needed(stock: Number, reserved: Number, threshold: Number) -> Bool {
  return stock - reserved < threshold;
}
export fn reorder_quantity(target: Number, stock: Number, reserved: Number) -> Number {
  let available = stock - reserved;
  if (available >= target) { return 0; }
  return target - available;
}
export fn cost_cents(quantity: Number, unit_cents: Number) -> Number {
  return quantity * unit_cents;
}
