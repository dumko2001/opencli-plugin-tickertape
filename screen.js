import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError } from '@jackwener/opencli/errors';
import { API_BASE, browserFetchJson, ensureTickertapePage, fetchJson, normalizeLimit, normalizeOffset, requireRows, rowFromScreenerResult } from './utils.js';

async function loadPrebuiltScreens() {
  const payload = await fetchJson(`${API_BASE}/screener/v2/prebuilt`, { bucket: 'screen-meta' });
  const screens = [];
  for (const group of payload?.data ?? []) {
    for (const item of group.screens ?? []) {
      const screen = item.screen ?? {};
      screens.push({
        id: item.id ?? screen.slug ?? screen._id,
        group: group.name ?? null,
        title: screen.title ?? null,
        slug: screen.slug ?? null,
        premium: screen.premium === true,
        locked: screen.locked === true,
        query: screen.query ?? {},
      });
    }
  }
  return screens;
}

function findScreen(screens, id) {
  const needle = String(id ?? '').trim().toLowerCase();
  if (!needle) throw new ArgumentError('screen id is required');
  return screens.find((screen) => [screen.id, screen.slug, screen.title]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === needle));
}

cli({
  site: 'tickertape',
  name: 'screen',
  access: 'read',
  description: 'Run a Tickertape ready-made screen by id/slug, including Pro screens when your browser session allows it',
  domain: 'www.tickertape.in',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'id', positional: true, required: true, help: 'Prebuilt screen id/slug, e.g. SCR0030 or SCR0150' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
    { name: 'offset', type: 'int', default: 0, help: 'Result offset for pagination' },
  ],
  columns: ['rank', 'screen', 'premium', 'sid', 'ticker', 'name', 'sector', 'subindustry', 'marketCap', 'lastPrice', 'pe', 'pb', 'roe', 'roce', 'upside', 'buyRecoPct', 'analystCount', 'slug'],
  func: async (page, args) => {
    const limit = normalizeLimit(args.limit, 20, 100);
    const offset = normalizeOffset(args.offset);
    const screens = await loadPrebuiltScreens();
    const screen = findScreen(screens, args.id);
    if (!screen) throw new ArgumentError(`Unknown prebuilt screen "${args.id}"`, 'Run tickertape prebuilt-screens to list screen ids');

    const query = screen.query ?? {};
    const project = query.project ?? [];
    const body = {
      ...query,
      offset,
      count: limit,
    };
    await ensureTickertapePage(page, `/screener/equity/prebuilt/${encodeURIComponent(screen.slug || screen.id)}`);
    const payload = await browserFetchJson(page, `${API_BASE}/screener/query`, {
      method: 'POST',
      body,
      service: 'root',
      bucket: 'screener',
    });
    const rows = requireRows(payload?.data?.results, 'tickertape screen', 'The selected screen returned no rows');
    return rows.map((item, index) => ({
      screen: screen.title,
      premium: screen.premium,
      ...rowFromScreenerResult(item, offset + index + 1, project),
    }));
  },
});
