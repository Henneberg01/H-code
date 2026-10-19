export const magnitude = (x: number): number => Math.abs(x);
export const total = (xs: number[]): number => xs.reduce((sum, x) => sum + x, 0);
