import "./rules.hc" as savings;
let balance = 1000;
let year = 0;
while (year < 3) {
  balance = savings::grow(balance, 10);
  year = year + 1;
}
print("SAVINGS");
print("years", year);
print("balance", balance);
print("target_reached", savings::reachable(balance, 1300));
