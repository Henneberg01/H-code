// Canonical15: independently authored idiomatic TypeScript competitor.
// Real SQLite + typed records + semantic HTML. No H-Code interpreter imported.
import { DatabaseSync } from 'node:sqlite';

export type RegionTotal = {
  region: string;
  paidOrders: number;
  revenueCents: number;
};
export type Dashboard = {
  byRegion: RegionTotal[];
  paidOrders: number;
  revenueCents: number;
};

function isValidDay(value: string): boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
function integer(n: unknown): number {
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)
    throw new TypeError('Database metric must be a nonnegative safe integer');
  return n;
}
function text(s: unknown): string {
  if(typeof s!=='string'||!s.isWellFormed()||
     new TextEncoder().encode(s).length>2048)
    throw new TypeError('Invalid database label');
  return s;
}

export function queryDashboard(file: string, from: string, to: string): Dashboard {
  if(!isValidDay(from)||!isValidDay(to)||from>=to)
    throw new TypeError('Invalid half-open ISO date range');
  const db=new DatabaseSync(file,{readOnly:true,allowExtension:false});
  try{
    const raw=db.prepare(
      'SELECT region,COUNT(*) AS paidOrders,SUM(amount_cents) AS revenueCents '+
      'FROM orders WHERE status=? AND day>=? AND day<? '+
      'GROUP BY region ORDER BY revenueCents DESC,region COLLATE BINARY ASC'
    ).all('paid',from,to);
    if(raw.length>1000)throw new RangeError('Result row limit exceeded');
    const byRegion=raw.map(row=>({
      region:text(row.region),paidOrders:integer(row.paidOrders),
      revenueCents:integer(row.revenueCents)
    }));
    const paidOrders=byRegion.reduce((total,row)=>total+row.paidOrders,0);
    const revenueCents=byRegion.reduce((total,row)=>total+row.revenueCents,0);
    integer(paidOrders);integer(revenueCents);
    return {byRegion,paidOrders,revenueCents};
  }finally{db.close();}
}

