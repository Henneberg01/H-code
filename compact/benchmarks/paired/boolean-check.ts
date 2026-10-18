const allowed = (admin: boolean, active: boolean): boolean => admin && active;
console.log(allowed(true, true));
