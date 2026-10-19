// Independent TypeScript correctness oracle for canonical15 (B0).
// This is NOT a competitive TypeScript source-size comparator and imports no H-Code runtime.
// Run with Node 22+: --experimental-sqlite --experimental-strip-types.
import {DatabaseSync} from 'node:sqlite';

type SeedOrder={id:number,region:string,amountCents:number,status:string,day:string};
type RegionTotals={region:string,paidOrders:number,revenueCents:number};
export type DashboardTotals={paidOrders:number,revenueCents:number,byRegion:RegionTotals[]};

function isValidDay(value:string):boolean{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}

export function seedDatabase(file:string,rows:SeedOrder[]):void{
  if(!Array.isArray(rows)||rows.length>5000)throw new RangeError('Seed rows must be bounded');
  // A real disk-backed SQLite file, not JSON, an object cache or mock DB.
  const db=new DatabaseSync(file);
  try{
    db.exec(`CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      region TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
      status TEXT NOT NULL CHECK(status IN ('paid','refunded','pending')),
      day TEXT NOT NULL
    )`);
    const insert=db.prepare('INSERT INTO orders (id,region,amount_cents,status,day) VALUES (?,?,?,?,?)');
    db.exec('BEGIN IMMEDIATE');
    try{
      for(const row of rows){
        if(!Number.isSafeInteger(row.id)||row.id<=0||
          typeof row.region!=='string'||row.region.length>128||!row.region.isWellFormed()||
          !Number.isSafeInteger(row.amountCents)||row.amountCents<0||
          !['paid','refunded','pending'].includes(row.status)||!isValidDay(row.day))
          throw new TypeError('Invalid seed row');
        insert.run(row.id,row.region,row.amountCents,row.status,row.day);
      }
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }finally{db.close();}
}

export function queryDashboard(file:string,from:string,to:string):DashboardTotals{
  if(!isValidDay(from)||!isValidDay(to)||from>=to)
    throw new TypeError('Invalid half-open ISO date range');
  const db=new DatabaseSync(file,{readOnly:true});
  try{
    const groups=db.prepare(`SELECT region, COUNT(*) AS paidOrders,
      SUM(amount_cents) AS revenueCents FROM orders
      WHERE status=? AND day>=? AND day<?
      GROUP BY region ORDER BY revenueCents DESC, region COLLATE BINARY ASC`)
      .all('paid',from,to).map(row=>({
        region:row.region,paidOrders:row.paidOrders,revenueCents:row.revenueCents
      })) as RegionTotals[];
    if(groups.length>1000)throw new RangeError('Dashboard group limit exceeded');
    for(const row of groups){
      if(typeof row.region!=='string'||!Number.isSafeInteger(row.paidOrders)||
        !Number.isSafeInteger(row.revenueCents)||row.revenueCents<0)
        throw new TypeError('Invalid database aggregate');
    }
    const paidOrders=groups.reduce((n,r)=>n+r.paidOrders,0);
    const revenueCents=groups.reduce((n,r)=>n+r.revenueCents,0);
    if(!Number.isSafeInteger(paidOrders)||!Number.isSafeInteger(revenueCents))
      throw new RangeError('Dashboard total overflow');
    return {paidOrders,revenueCents,byRegion:groups};
  }finally{db.close();}
}

const escapeText=(x:string):string=>x.replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
} as Record<string,string>)[ch]);

export function renderDashboard(totals:DashboardTotals,from:string,to:string):string{
  if(!isValidDay(from)||!isValidDay(to)||from>=to)throw new TypeError('Invalid range');
  const rows=totals.byRegion.map(row=>
    `<tr><th scope="row">${escapeText(row.region)}</th><td>${row.paidOrders}</td><td>${row.revenueCents}</td></tr>`).join('');
  const empty=totals.byRegion.length===0?'<p id="empty">No paid orders in this period.</p>':'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Database dashboard</title></head><body><main><h1>Paid orders dashboard</h1><p id="range">${from} to ${to} (exclusive)</p><p id="summary" role="status" aria-live="polite">${totals.paidOrders} paid orders, ${totals.revenueCents} minor units</p>${empty}<table id="results"><caption>Paid orders and revenue by region</caption><thead><tr><th scope="col">Region</th><th scope="col">Paid orders</th><th scope="col">Revenue (minor units)</th></tr></thead><tbody>${rows}</tbody></table></main></body></html>`;
}
