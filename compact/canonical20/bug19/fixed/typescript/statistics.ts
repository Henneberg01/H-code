import {summarize} from './core.ts';

export {summarize};
export const positiveSummary = (values: number[]) => summarize(values.filter(value => value > 0));
