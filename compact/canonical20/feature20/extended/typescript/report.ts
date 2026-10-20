import {summarize, positiveSummary} from './statistics.ts';

export const report = (values: number[]): string => JSON.stringify(summarize(values));
export const positiveReport = (values: number[]): string => JSON.stringify(positiveSummary(values));
import {rangeSummary} from './statistics.ts';
export const rangeReport = (values: number[], lower: number, upper: number): string =>
  JSON.stringify(rangeSummary(values, lower, upper));
