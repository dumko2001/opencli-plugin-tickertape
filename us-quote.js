import { cli, Strategy } from '@jackwener/opencli/registry';
import { GMS_BASE, fetchJson, normalizeTicker, parseCsv, requireRows } from './utils.js';

function mapQuote(ticker, item) {
  const price = item?.p ?? null;
  const prevClose = item?.lcp ?? null;
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
  return {
    ticker,
    price,
    prevClose,
    change,
    changePct,
    volume: item?.v ?? null,
    time: item?.t ? new Date(item.t).toISOString() : null,
  };
}

cli({
  site: 'tickertape',
  name: 'us-quote',
  access: 'read',
  description: 'Get Tickertape US stock quotes by ticker',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'tickers', positional: true, required: true, help: 'Comma-separated US tickers, e.g. ACN,MSFT' },
  ],
  columns: ['ticker', 'price', 'prevClose', 'change', 'changePct', 'volume', 'time'],
  func: async (args) => {
    const tickers = parseCsv(args.tickers, '').map(normalizeTicker);
    const url = new URL(`${GMS_BASE}/quotes/US/latest`);
    url.searchParams.set('tickers', tickers.join(','));
    const payload = await fetchJson(url, { bucket: 'gms', service: 'gms' });
    const data = payload?.data ?? {};
    const rows = tickers
      .map((ticker) => mapQuote(ticker, data[ticker]))
      .filter((row) => row.price != null || row.prevClose != null);
    return requireRows(rows, 'tickertape us-quote', 'Check the US ticker values');
  },
});
