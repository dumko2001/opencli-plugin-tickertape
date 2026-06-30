import { cli, Strategy } from '@jackwener/opencli/registry';
import { QUOTES_BASE, fetchJson, parseCsv, requireRows } from './utils.mjs';

cli({
  site: 'tickertape',
  name: 'quote',
  access: 'read',
  description: 'Get live Tickertape quotes by sid',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'sids', positional: true, required: true, help: 'Comma-separated Tickertape sid values, e.g. RELI,HDBK' },
  ],
  columns: ['sid', 'exchange', 'price', 'open', 'high', 'low', 'prevClose', 'change', 'changePct', 'volume', 'turnover', 'time'],
  func: async (args) => {
    const sids = parseCsv(args.sids, '');
    const url = new URL(`${QUOTES_BASE}/quotes`);
    url.searchParams.set('sids', sids.join(','));
    const payload = await fetchJson(url, { bucket: 'quotes' });
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return requireRows(rows, 'tickertape quote', 'Check the sid values').map((item) => ({
      sid: item.sid,
      exchange: item.exchange ?? null,
      price: item.price ?? null,
      open: item.o ?? null,
      high: item.h ?? null,
      low: item.l ?? null,
      prevClose: item.c ?? null,
      change: item.change ?? null,
      changePct: item.dyChange ?? null,
      volume: item.vol ?? null,
      turnover: item.turnover ?? null,
      time: item.ts ? new Date(item.ts).toISOString() : null,
    }));
  },
});

