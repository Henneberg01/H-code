import {readFileSync} from 'node:fs';

export function numbers(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('Expected finite numbers');
  }
  return value;
}
export const readInput = (): unknown => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(readFileSync(0)));
