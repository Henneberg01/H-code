function head<T>(xs: T[]): T { return xs[0]; }
function repeat<T>(xs: T[]): T[] { return xs.concat(xs); }
console.log(head([2,3]));
console.log(head(["a","b"]));
console.log(head([true,false]));
console.log(repeat([2,3]).length);
