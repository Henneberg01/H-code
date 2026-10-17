import "./rules.hc" as stock;
print("INVENTORY");
let items = 15;
let reserved = 7;
let threshold = 10;
print("reorder", stock::reorder_needed(items, reserved, threshold));
let buy = stock::reorder_quantity(30, items, reserved);
print("order_units", buy);
print("purchase_cents", stock::cost_cents(buy, 299));
