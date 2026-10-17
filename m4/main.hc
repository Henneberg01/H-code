import "./std/math.hc" as math;
import "./std/text.hc" as text;
use "demo.math@1.0.0" as legacy;
print(math::square(7));
print(math::shifted(2));
print(text::greeting("world"));
print(text::repeat2("ha"));
print(legacy::add(4, 5));
