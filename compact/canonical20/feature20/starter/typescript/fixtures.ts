import {readFileSync} from 'node:fs';

export const cases: {id: string; values: number[]; summary: string; positive: string}[] =
  JSON.parse(readFileSync(new URL('./data/cases.json', import.meta.url), 'utf8'));
