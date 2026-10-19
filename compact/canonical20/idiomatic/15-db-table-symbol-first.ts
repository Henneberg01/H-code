import { DatabaseSync } from 'node:sqlite';

type Order = {
  amount_cents: number;
  day: string;
  region: string;
  status: string;
};

const database = new DatabaseSync('orders.sqlite', { readOnly: true });
try {
  const statement = database.prepare(
    'SELECT amount_cents,day,region,status FROM orders ' +
    'ORDER BY amount_cents ASC,day COLLATE BINARY ASC,' +
    'region COLLATE BINARY ASC,status COLLATE BINARY ASC'
  );
  const orders = statement.all() as Order[];
  for (const order of orders) {
    if (!Number.isSafeInteger(order.amount_cents) ||
        typeof order.day !== 'string' ||
        typeof order.region !== 'string' ||
        typeof order.status !== 'string') {
      throw new TypeError('SQLite order did not match the declared record type');
    }
  }
  const januaryPaid = orders
    .filter(order => order.status === 'paid' &&
      order.day >= '2026-01-01' && order.day < '2026-02-01')
    .map(order => ({ amount: order.amount_cents, region: order.region }));
  console.log(JSON.stringify(januaryPaid));
} finally {
  database.close();
}
