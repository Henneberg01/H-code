import {report, positiveReport} from './report.ts';
import {numbers, readInput} from './input.ts';

const values = numbers(readInput());
console.log(report(values));
console.log(positiveReport(values));
