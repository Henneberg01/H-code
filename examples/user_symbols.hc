// Both call paths resolve to demo.math@1.0.0::add.
use "demo.math@1.0.0" as math;

print(⊕(20, 22));
print(math::add(20, 22));
print(math∷⊕(5, 6));
print(▦("hi"));
print(⊙(3));
print(⊗(5));
