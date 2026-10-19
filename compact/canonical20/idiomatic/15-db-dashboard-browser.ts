// Independent idiomatic TypeScript browser comparator; no H-Code imports.
// Renders only semantic DOM from strictly validated JSON.
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

export function parseDashboard(value: unknown): Dashboard {
  if(value===null||typeof value!=='object'||Array.isArray(value))
    throw new TypeError('Dashboard JSON must be a record');
  const report=value as Record<string,unknown>;
  if(Object.keys(report).sort().join(',')!=='byRegion,paidOrders,revenueCents'||
     !Array.isArray(report.byRegion)||report.byRegion.length>1000)
    throw new TypeError('Unexpected dashboard JSON fields');
  const byRegion=report.byRegion.map(value=>{
    if(value===null||typeof value!=='object'||Array.isArray(value))
      throw new TypeError('Unexpected region record');
    const row=value as Record<string,unknown>;
    if(Object.keys(row).sort().join(',')!=='paidOrders,region,revenueCents')
      throw new TypeError('Unexpected region fields');
    return {
      region:text(row.region),paidOrders:integer(row.paidOrders),
      revenueCents:integer(row.revenueCents)
    };
  });
  return {byRegion,paidOrders:integer(report.paidOrders),
    revenueCents:integer(report.revenueCents)};
}

export function renderDashboard(report: Dashboard, doc: Document): void {
  const summary=doc.querySelector('#summary');
  const empty=doc.querySelector('#empty');
  const table=doc.querySelector('#results');
  if(!summary||!empty||!(table instanceof HTMLTableElement))
    throw new TypeError('Dashboard DOM is missing semantic targets');
  const caption=doc.createElement('caption');
  caption.textContent='Paid orders and revenue by region';
  const head=doc.createElement('thead');
  const labels=['Region','Paid orders','Revenue (minor units)'];
  const heading=doc.createElement('tr');
  for(const title of labels){
    const cell=doc.createElement('th');
    cell.scope='col';cell.textContent=title;heading.append(cell);
  }
  head.append(heading);
  const body=doc.createElement('tbody');
  for(const row of report.byRegion){
    const tr=doc.createElement('tr');
    [row.region,String(row.paidOrders),String(row.revenueCents)]
      .forEach((value,index)=>{
        const cell=doc.createElement(index===0?'th':'td');
        if(index===0)(cell as HTMLTableCellElement).scope='row';
        cell.textContent=value;
        tr.append(cell);
      });
    body.append(tr);
  }
  table.replaceChildren(caption,head,body);
  summary.textContent=report.paidOrders+' paid orders, '+
    report.revenueCents+' minor units';
  empty.textContent=report.paidOrders===0?'No paid orders in this period.':'';
}
if(typeof document!=='undefined'&&document.querySelector('#payload')){
  const field=document.querySelector<HTMLInputElement>('#payload');
  if(!field)throw new TypeError('Missing dashboard data');
  renderDashboard(parseDashboard(JSON.parse(field.value)),document);
}
