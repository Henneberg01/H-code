import {summarize} from './core.ts';

export {summarize};
export const positiveSummary = (values: number[]) => summarize(values.filter(value => value > 0));
export const rangeSummary = (values: number[], lower: number, upper: number) =>
  summarize(values.filter(value => value >= lower && value <= upper));
