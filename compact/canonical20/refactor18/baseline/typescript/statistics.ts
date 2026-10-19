import type {Summary} from './types.ts';

export function summarize(values: number[]): Summary {
  const count = values.length;
  let total = 0;
  let minimum = count ? values[0] : 0;
  let maximum = minimum;
  for (const value of values) {
    total += value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return {count, maximum, mean: count ? total / count : 0, minimum, total};
}

export function positiveSummary(values: number[]): Summary {
  let count = 0;
  let total = 0;
  let minimum = 0;
  let maximum = 0;
  for (const value of values) {
    if (value > 0) {
      minimum = count ? Math.min(minimum, value) : value;
      maximum = count ? Math.max(maximum, value) : value;
      total += value;
      count++;
    }
  }
  return {count, maximum, mean: count ? total / count : 0, minimum, total};
}
