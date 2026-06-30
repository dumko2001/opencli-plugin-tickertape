import { cli, Strategy } from '@jackwener/opencli/registry';
import { ECOSYSTEM_BASE, browserFetchJson, ensureTickertapePage, normalizeLimit } from './utils.js';

cli({
  site: 'tickertape',
  name: 'watchlist',
  access: 'read',
  description: 'List Tickertape watchlists from the logged-in browser session',
  domain: 'www.tickertape.in',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'assetClass', type: 'string', default: 'SECURITY', help: 'SECURITY or MUTUALFUND' },
    { name: 'market', type: 'string', default: 'IN,US', help: 'Market filter, e.g. IN or IN,US' },
    { name: 'limit', type: 'int', default: 50, help: 'Maximum rows to return (max 200)' },
  ],
  columns: ['rank', 'id', 'name', 'assetClass', 'market', 'count', 'updatedAt'],
  func: async (page, args) => {
    const limit = normalizeLimit(args.limit, 50, 200);
    const assetClass = String(args.assetClass ?? 'SECURITY').toUpperCase();
    const market = String(args.market ?? 'IN,US').toUpperCase();
    await ensureTickertapePage(page, '/screener/equity');
    const url = new URL(`${ECOSYSTEM_BASE}/watchlists`);
    url.searchParams.set('assetClass', assetClass);
    url.searchParams.set('market', market);
    const payload = await browserFetchJson(page, url, { service: 'ecosystem', bucket: 'account' });
    return (payload?.data ?? []).slice(0, limit).map((watchlist, index) => ({
      rank: index + 1,
      id: watchlist?._id ?? watchlist?.id ?? watchlist?.watchlistId ?? null,
      name: watchlist?.name ?? watchlist?.title ?? null,
      assetClass: watchlist?.assetClass ?? assetClass,
      market: watchlist?.market ?? market,
      count: watchlist?.count ?? watchlist?.constituents?.length ?? watchlist?.items?.length ?? null,
      updatedAt: watchlist?.updatedAt ?? watchlist?.updated ?? null,
    }));
  },
});
