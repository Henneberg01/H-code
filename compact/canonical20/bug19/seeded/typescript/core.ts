import type {Summary} from './types.ts';

export function summarize(values: number[]): Summary {
  const count = values.length;
  let total = 0;
  let minimum = count ? values[0] : 0;
  let maximum = minimum;
  for (const value of values.slice(0,16)) {
    total += value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return {count, maximum, mean: count ? total / count : 0, minimum, total};
}
