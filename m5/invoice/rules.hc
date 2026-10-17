export fn line_total(unit_cents: Number, quantity: Number) -> Number { return unit_cents * quantity; }
export fn discount_cents(subtotal: Number, percent: Number) -> Number { return subtotal * percent / 100; }
export fn tax_cents(net: Number, percent: Number) -> Number { return net * percent / 100; }
export fn grand_total(subtotal: Number, discount: Number, tax: Number) -> Number { return subtotal - discount + tax; }
