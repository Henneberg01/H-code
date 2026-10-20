import {rangeReport} from './report.ts';
import {numbers, readInput} from './input.ts';

const input = readInput();
if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 3) throw new Error('Expected range request');
const request = input as Record<string, unknown>;
const {lower, upper} = request;
if (typeof lower !== 'number' || !Number.isFinite(lower) ||
    typeof upper !== 'number' || !Number.isFinite(upper)) throw new Error('Expected finite bounds');
console.log(rangeReport(numbers(request.values), lower, upper));
