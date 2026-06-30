import { cli, Strategy } from '@jackwener/opencli/registry';
import { API_BASE, fetchJson, normalizeLimit, requireRows, WEB_BASE } from './utils.js';

function mapSearchItem(item, rank, fallbackType = null) {
  return {
    rank,
    type: item.type ?? item.index ?? fallbackType,
    sid: item.sid ?? item.mfId ?? item.id ?? null,
    ticker: item.ticker ?? null,
    name: item.name ?? null,
    sector: item.sector ?? null,
    price: item.quote?.price ?? item.nav ?? null,
    change: item.quote?.change ?? null,
    match: item.match ?? null,
    url: item.slug ? `${WEB_BASE}${item.slug}` : null,
  };
}

export function mapSearchPayload(payload, limit) {
  const rows = [];
  const currentItems = payload?.data?.items;
  if (Array.isArray(currentItems)) {
    for (const item of currentItems) {
      rows.push(mapSearchItem(item, rows.length + 1));
    }
    return rows.slice(0, limit);
  }

  const groups = ['stocks', 'mutualFunds', 'etfs', 'indices', 'usStocks'];
  for (const group of groups) {
    for (const item of payload?.data?.[group] ?? []) {
      rows.push(mapSearchItem(item, rows.length + 1, group));
    }
  }
  return rows.slice(0, limit);
}

cli({
  site: 'tickertape',
  name: 'search',
  access: 'read',
  description: 'Search Tickertape stocks, funds, ETFs, and indices by text',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search text, ticker, or company name' },
    { name: 'limit', type: 'int', default: 10, help: 'Maximum rows to return (max 50)' },
  ],
  columns: ['rank', 'type', 'sid', 'ticker', 'name', 'sector', 'price', 'change', 'match', 'url'],
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 10, 50);
    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set('text', String(args.query));
    const payload = await fetchJson(url);
    return requireRows(mapSearchPayload(payload, limit), 'tickertape search', 'Try a different search query');
  },
});
