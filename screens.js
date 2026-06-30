import { cli, Strategy } from '@jackwener/opencli/registry';
import { API_BASE, browserFetchJson, ensureTickertapePage, normalizeLimit } from './utils.mjs';

cli({
  site: 'tickertape',
  name: 'screens',
  access: 'read',
  description: 'List saved Tickertape screener screens from the logged-in browser session',
  domain: 'www.tickertape.in',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int', default: 50, help: 'Maximum rows to return (max 200)' },
  ],
  columns: ['rank', 'id', 'title', 'description', 'filterCount', 'sortBy', 'sortOrder', 'updatedAt'],
  func: async (page, args) => {
    const limit = normalizeLimit(args.limit, 50, 200);
    await ensureTickertapePage(page, '/screener/equity');
    const payload = await browserFetchJson(page, `${API_BASE}/screener/screens`, { service: 'root', bucket: 'account' });
    return (payload?.data ?? []).slice(0, limit).map((screen, index) => ({
      rank: index + 1,
      id: screen?._id ?? screen?.id ?? screen?.slug ?? null,
      title: screen?.title ?? screen?.name ?? null,
      description: screen?.description ?? null,
      filterCount: Object.keys(screen?.query?.match ?? {}).length,
      sortBy: screen?.query?.sortBy ?? null,
      sortOrder: screen?.query?.sortOrder ?? null,
      updatedAt: screen?.updatedAt ?? screen?.updated ?? null,
    }));
  },
});
